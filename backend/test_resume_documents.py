"""Offline regression coverage: no actual compiler/server/startup/database required."""
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.responses import ApiException, api_exception_handler
from app.db.session import Base, get_db
from app.models.chat import ChatSession
from app.resume_schemas import Resume
from app.routers_fe.resume_documents import router
from app.routers_fe.utils import get_fe_user
from app.services import resume_document_service as service


class ResumeDocumentTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.engine = create_engine('sqlite:///' + str(Path(self.temp.name) / 'test.db'), connect_args={'check_same_thread': False})
        Base.metadata.create_all(self.engine, tables=[ChatSession.__table__, service.ResumeDocument.__table__, service.ResumeDocumentHistory.__table__])
        self.factory = sessionmaker(self.engine, expire_on_commit=False)
        self.db = self.factory()
        self.db.add_all([ChatSession(id='one', user_id='alice'), ChatSession(id='two', user_id='alice'), ChatSession(id='other', user_id='bob')])
        self.db.commit()
        self.resume = Resume.model_validate({'name': '真实用户', 'sections': [{'title': '工作经历', 'column': 'right', 'entries': [{'heading': '用户提供的公司', 'items': ['用户提供的经历']}]}]}).model_dump()

    def tearDown(self):
        self.db.close()
        self.engine.dispose()
        self.temp.cleanup()

    def call(self, name, args=None, user='alice', conv='one', db=None):
        return service.execute_tool(db or self.db, user, conv, name, args or {})

    def assert_status(self, status, fn):
        with self.assertRaises(ApiException) as caught:
            fn()
        self.assertEqual(caught.exception.status_code, status)

    def update(self, revision=0, resume=None):
        return self.call('resume_update', {'resume': self.resume if resume is None else resume, 'expectedRevision': revision})

    def test_empty_draft_no_fabrication(self):
        self.assertEqual(self.call('resume_read'), {'resume': {'name': '', 'contact': '', 'summary': '', 'sections': []}, 'template': 'classic', 'revision': 0, 'exists': False})
        state = self.call('resume_set_template', {'template': 'sidebar', 'expectedRevision': 0})
        self.assertEqual(state['resume'], Resume().model_dump())
        self.assertEqual(state['revision'], 1)

    def test_ownership_all_tools_and_documents(self):
        for name in ['resume_read', 'resume_update', 'resume_set_template', 'resume_compile']:
            self.assert_status(404, lambda: self.call(name, user='bob'))
        self.assert_status(404, lambda: service.read_pdf(self.db, 'bob', 'one', 0))
        self.assert_status(404, lambda: service.write_document(self.db, 'bob', 'one', {}))
        self.update()
        self.assertFalse(self.call('resume_read', conv='two')['exists'])
        self.assertFalse(self.call('resume_read', user='bob', conv='other')['exists'])

    def test_persistence_template_preserves_entries_and_conflict(self):
        saved = self.update()
        self.assertEqual(saved['revision'], 1)
        with self.factory() as fresh:
            persisted = self.call('resume_read', db=fresh)
            self.assertEqual(persisted, {key: saved[key] for key in persisted})
            self.assertEqual(saved['previousRevision'], 0)
            self.assertEqual(saved['changes'][0], {'field': '姓名', 'before': '', 'after': self.resume['name']})
        self.assert_status(409, lambda: self.update())
        state = self.call('resume_set_template', {'template': 'sidebar', 'expectedRevision': 1})
        self.assertEqual(state['resume'], self.resume)
        self.assertEqual(state['revision'], 2)
        self.assertEqual(state['template'], 'sidebar')
        self.assert_status(409, lambda: self.call('resume_set_template', {'template': 'classic', 'expectedRevision': 1}))

    def test_partial_updates_invalid_params_and_size_rejected(self):
        self.update()
        self.assert_status(400, lambda: self.update(1, {'name': 'partial'}))
        bad = dict(self.resume, sections=[{'title': '工作经历', 'items': []}])
        self.assert_status(400, lambda: self.update(1, bad))
        self.assert_status(400, lambda: self.call('resume_set_template', {'template': '../x', 'expectedRevision': 1}))
        self.assert_status(400, lambda: self.call('resume_read', {'path': 'secret'}))
        self.assert_status(400, lambda: self.call('resume_compile', {'source': '\\input{secret}'}))
        self.assert_status(400, lambda: self.update(1, dict(self.resume, sections=[{'title': '技能', 'column': 'auto', 'entries': [], 'items': ['中' * 22000]}])))
        self.assertEqual(self.call('resume_read')['revision'], 1)

    def test_compile_cache_escape_stale_revision(self):
        self.resume['name'] = r'\input{secret}'
        self.update()
        with patch.object(service.resume_service, 'compile_pdf', return_value=(b'%PDF-test', ['warning'])) as compiler:
            result = self.call('resume_compile')
            self.assertEqual(result, {'revision': 1, 'template': 'classic', 'pdfUrl': '/api/resume/documents/one/pdf?revision=1', 'warnings': ['warning']})
            self.assertNotIn(r'\input{secret}', compiler.call_args.args[0])
            self.assertIn(r'\textbackslash{}input\{secret\}', compiler.call_args.args[0])
            self.assertEqual(service.read_pdf(self.db, 'alice', 'one', 1), b'%PDF-test')
            self.call('resume_compile')
            self.assertEqual(compiler.call_count, 1)
        self.call('resume_set_template', {'template': 'sidebar', 'expectedRevision': 1})
        self.assert_status(409, lambda: service.read_pdf(self.db, 'alice', 'one', 1))
        self.assert_status(404, lambda: service.read_pdf(self.db, 'alice', 'one', 2))

    def test_compile_race_does_not_cache_or_return_old_pdf(self):
        self.update()
        def racing_compile(*args):
            with self.factory() as fresh:
                self.call('resume_set_template', {'template': 'sidebar', 'expectedRevision': 1}, db=fresh)
            return b'%PDF-old', []
        with patch.object(service.resume_service, 'compile_pdf', side_effect=racing_compile):
            self.assert_status(409, lambda: self.call('resume_compile'))
        self.assert_status(404, lambda: service.read_pdf(self.db, 'alice', 'one', 2))

    def test_delete_document_joins_caller_transaction(self):
        self.update()
        self.assert_status(404, lambda: service.delete_document(self.db, 'bob', 'one'))
        service.delete_document(self.db, 'alice', 'one')
        self.db.rollback()
        self.assertTrue(self.call('resume_read')['exists'])
        service.delete_document(self.db, 'alice', 'one')
        self.db.commit()
        self.assertFalse(self.call('resume_read')['exists'])

    def test_history_undo_consumes_stack_without_toggling(self):
        self.update()
        self.update(1, dict(self.resume, name='第二版'))
        self.call('resume_set_template', {'template': 'sidebar', 'expectedRevision': 2})
        state = service.undo_document(self.db, 'alice', 'one', {'expectedRevision': 3})
        self.assertEqual((state['revision'], state['template'], state['resume']['name']), (4, 'classic', '第二版'))
        state = service.undo_document(self.db, 'alice', 'one', {'expectedRevision': 4})
        self.assertEqual((state['revision'], state['resume']['name']), (5, '真实用户'))
        state = service.undo_document(self.db, 'alice', 'one', {'expectedRevision': 5})
        self.assertEqual((state['revision'], state['resume']['name']), (6, ''))
        self.assertFalse(service.read_history(self.db, 'alice', 'one')['canUndo'])
        self.assert_status(409, lambda: service.undo_document(self.db, 'alice', 'one', {'expectedRevision': 6}))
        # A new edit after undo starts a new stack entry, not a redo/toggle.
        self.update(6)
        restored = service.undo_document(self.db, 'alice', 'one', {'expectedRevision': 7})
        self.assertEqual(restored['resume']['name'], '')

    def test_history_isolation_conflicts_retention_and_cleanup(self):
        for revision in range(25):
            self.update(revision, dict(self.resume, name=f'姓名{revision}'))
        history = service.read_history(self.db, 'alice', 'one')
        self.assertEqual(len(history['items']), 20)
        self.assertEqual(history['items'][-1]['revision'], 6)
        self.assertEqual(history['items'][0]['changes'][0]['field'], '姓名')
        self.assertFalse(any('pdf' in column.name for column in service.ResumeDocumentHistory.__table__.columns))
        self.assertEqual(service.read_history(self.db, 'alice', 'two')['items'], [])
        self.assert_status(404, lambda: service.read_history(self.db, 'bob', 'one'))
        self.assert_status(404, lambda: service.undo_document(self.db, 'bob', 'one', {'expectedRevision': 25}))
        self.assert_status(409, lambda: service.undo_document(self.db, 'alice', 'one', {'expectedRevision': 24}))
        self.assertEqual(service.read_history(self.db, 'alice', 'one'), history)
        service.delete_document(self.db, 'alice', 'one')
        self.db.rollback()
        self.assertEqual(len(service.read_history(self.db, 'alice', 'one')['items']), 20)
        service.delete_document(self.db, 'alice', 'one')
        self.db.commit()
        self.assertEqual(service.read_history(self.db, 'alice', 'one')['items'], [])

    def test_undo_invalidates_pdf_and_api_contract(self):
        self.update()
        with patch.object(service.resume_service, 'compile_pdf', return_value=(b'%PDF-test', [])):
            self.call('resume_compile')
        app = FastAPI()
        app.include_router(router, prefix='/api')
        app.add_exception_handler(ApiException, api_exception_handler)
        app.dependency_overrides[get_db] = lambda: self.db
        with TestClient(app) as client:
            self.assertEqual(client.get('/api/resume/documents/one/history').status_code, 401)
            self.assertEqual(client.post('/api/resume/documents/one/undo', json={'expectedRevision': 1}).status_code, 401)
            app.dependency_overrides[get_fe_user] = lambda: type('User', (), {'id': 'alice'})()
            self.assertEqual(client.get('/api/resume/documents/one/history').json()['items'][0]['revision'], 1)
            self.assertEqual(client.post('/api/resume/documents/one/undo', json={'expectedRevision': 0}).status_code, 409)
            self.assertEqual(client.post('/api/resume/documents/one/undo', json={'expectedRevision': 1}).json()['revision'], 2)
            self.assertEqual(client.get('/api/resume/documents/other/history').status_code, 404)
            self.assertEqual(client.post('/api/resume/documents/other/undo', json={'expectedRevision': 0}).status_code, 404)
        self.assert_status(409, lambda: service.read_pdf(self.db, 'alice', 'one', 1))
        self.assert_status(404, lambda: service.read_pdf(self.db, 'alice', 'one', 2))

    def test_history_failure_rolls_back_document_atomically(self):
        self.update()
        with patch.object(service, '_changes', side_effect=RuntimeError('history failed')):
            with self.assertRaises(RuntimeError):
                self.update(1, dict(self.resume, name='不能写入'))
        self.assertEqual(self.call('resume_read')['revision'], 1)
        self.assertEqual(len(service.read_history(self.db, 'alice', 'one')['items']), 1)

    def test_compile_errors_do_not_leak_paths(self):
        with patch.object(service.resume_service, 'compile_pdf', side_effect=RuntimeError('C:/secret/file.tex')):
            with self.assertRaises(ApiException) as caught:
                self.call('resume_compile')
        self.assertEqual(caught.exception.status_code, 503)
        self.assertNotIn('secret', caught.exception.message)

    def test_api_contract_and_auth_dependency(self):
        app = FastAPI()
        app.include_router(router, prefix='/api')
        app.add_exception_handler(ApiException, api_exception_handler)
        def database():
            with self.factory() as db:
                yield db
        app.dependency_overrides[get_db] = database
        with TestClient(app) as client:
            self.assertEqual(client.get('/api/resume/documents/one').status_code, 401)
            app.dependency_overrides[get_fe_user] = lambda: type('User', (), {'id': 'alice'})()
            self.assertEqual(client.get('/api/resume/documents/one').json()['revision'], 0)
            response = client.put('/api/resume/documents/one', json={'resume': self.resume, 'template': 'sidebar', 'expectedRevision': 0})
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json()['template'], 'sidebar')
            self.assertEqual(client.put('/api/resume/documents/one', json={'resume': self.resume, 'template': 'classic', 'expectedRevision': 0}).status_code, 409)
            self.assertEqual(client.get('/api/resume/documents/other').status_code, 404)
            with patch.object(service.resume_service, 'compile_pdf', return_value=(b'%PDF-test', [])):
                compiled = client.post('/api/resume/documents/one/compile').json()
            self.assertEqual(client.get(compiled['pdfUrl']).content, b'%PDF-test')
            self.assertEqual(client.get('/api/resume/documents/one/pdf?revision=0').status_code, 409)


if __name__ == '__main__':
    unittest.main()
