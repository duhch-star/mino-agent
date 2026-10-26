"""Focused save-result tests; offline SQLite and no compiler/server required."""
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker

from app.core.responses import ApiException
from app.db.session import Base
from app.models.chat import ChatSession
from app.resume_schemas import Resume
from app.services import resume_document_service as service


class ResumeToolResultTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.engine = create_engine('sqlite:///' + str(Path(self.temp.name) / 'results.db'))
        Base.metadata.create_all(self.engine, tables=[ChatSession.__table__, service.ResumeDocument.__table__, service.ResumeDocumentHistory.__table__])
        self.factory = sessionmaker(self.engine, expire_on_commit=False)
        self.db = self.factory()
        self.db.add(ChatSession(id='conversation', user_id='alice'))
        self.db.commit()

    def tearDown(self):
        self.db.close()
        self.engine.dispose()
        self.temp.cleanup()

    def call(self, name, args, db=None):
        return service.execute_tool(db or self.db, 'alice', 'conversation', name, args)

    def test_authoritative_changes_match_committed_history_and_preserve_read_contract(self):
        first = Resume(name='旧姓名', contact='联系方式', sections=[{'title': '经历', 'items': ['原文']}]).model_dump()
        result = self.call('resume_update', {'resume': first, 'expectedRevision': 0})
        self.assertEqual((result['previousRevision'], result['revision']), (0, 1))
        self.assertEqual(result['changes'][0], {'field': '姓名', 'before': '', 'after': '旧姓名'})
        # A fresh database read remains the ordinary complete document state.
        with self.factory() as fresh:
            current = self.call('resume_read', {}, fresh)
            self.assertEqual(current, {key: result[key] for key in ('resume', 'template', 'revision', 'exists')})
        second = dict(first, name='新姓名')
        result = self.call('resume_update', {'resume': second, 'expectedRevision': 1})
        self.assertEqual(result['changes'], [{'field': '姓名', 'before': '旧姓名', 'after': '新姓名'}])
        self.assertEqual(result['previousRevision'], 1)
        history = self.db.scalar(select(service.ResumeDocumentHistory).where(service.ResumeDocumentHistory.revision == 1))
        self.assertEqual(result['changes'], json.loads(history.changes_json))
        self.assertEqual(result['resume']['sections'], first['sections'])

    def test_template_noop_and_stale_writes(self):
        result = self.call('resume_set_template', {'template': 'sidebar', 'expectedRevision': 0})
        self.assertEqual(result['previousRevision'], 0)
        self.assertEqual(result['changes'], [{'field': '简历模板', 'before': '经典单栏', 'after': '侧栏双栏'}])
        result = self.call('resume_set_template', {'template': 'sidebar', 'expectedRevision': 1})
        self.assertEqual((result['previousRevision'], result['revision'], result['changes']), (1, 2, []))
        with self.assertRaises(ApiException) as caught:
            self.call('resume_set_template', {'template': 'classic', 'expectedRevision': 1})
        self.assertEqual(caught.exception.status_code, 409)
        self.assertEqual(self.call('resume_read', {})['revision'], 2)

    def test_save_metadata_never_runs_compiler_and_write_api_shape_stays_compatible(self):
        with patch.object(service.resume_service, 'compile_pdf', side_effect=AssertionError('unexpected compile')):
            result = service.write_document(self.db, 'alice', 'conversation', {
                'resume': Resume(name='原名').model_dump(), 'template': 'classic', 'expectedRevision': 0})
            self.assertNotIn('changes', result)
            self.assertNotIn('previousRevision', result)
            result = self.call('resume_update', {'resume': Resume(name='更名').model_dump(), 'expectedRevision': 1})
            self.assertEqual(result['changes'], [{'field': '姓名', 'before': '原名', 'after': '更名'}])


if __name__ == '__main__':
    unittest.main()
