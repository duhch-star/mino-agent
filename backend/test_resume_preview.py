"""Read-only resume entry/PNG tests with synthetic accounts and PDFs only."""
import hashlib
import unittest
from types import SimpleNamespace
from uuid import UUID

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select, func
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.core.responses import api_exception_handler, ApiException
from app.db.session import Base, get_db
from app.models.chat import ChatSession, ResumeDocument
from app.routers_fe.resume_documents import router
from app.routers_fe.utils import get_fe_user


class ResumePreviewTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine('sqlite://', connect_args={'check_same_thread': False}, poolclass=StaticPool)
        Base.metadata.create_all(self.engine, tables=[ChatSession.__table__, ResumeDocument.__table__])
        self.db = Session(self.engine)
        self.app = FastAPI()
        self.app.include_router(router)
        self.app.add_exception_handler(ApiException, api_exception_handler)
        self.app.dependency_overrides[get_db] = lambda: self.db
        self.app.dependency_overrides[get_fe_user] = lambda: SimpleNamespace(id='alice')
        self.client = TestClient(self.app)

    def tearDown(self):
        self.client.close()
        self.db.close()
        self.engine.dispose()

    def add(self, conv, owner, revision=1, pdf_revision=1):
        import pypdfium2 as pdfium
        with pdfium.PdfDocument.new() as pdf:
            pdf.new_page(300, 400)
            import io
            output = io.BytesIO()
            pdf.save(output)
        self.db.add(ChatSession(id=conv, user_id=owner))
        self.db.add(ResumeDocument(user_id=owner, conversation_id=conv, revision=revision,
                                  pdf_revision=pdf_revision, pdf_data=output.getvalue(), resume_json='{}', template='classic'))
        self.db.commit()

    def test_new_account_does_not_create_sample_or_draft(self):
        for _ in range(2):
            result = self.client.get('/resume/documents/current')
            self.assertEqual(result.json(), {'exists': False, 'template': 'classic', 'pdfReady': False})
        self.assertEqual(self.db.scalar(select(func.count()).select_from(ResumeDocument)), 0)
        self.assertEqual(self.db.scalar(select(func.count()).select_from(ChatSession)), 0)

    def test_own_session_preferred_no_cross_account(self):
        sid = '12345678-1234-1234-1234-123456789abc'
        conv = 'conv_pi_' + hashlib.sha256(('alice:' + str(UUID(sid))).encode()).hexdigest()[:24]
        self.add(conv, 'alice')
        self.add('another', 'alice')
        self.add('private', 'bob')
        self.assertFalse(self.client.get('/resume/documents/current').json()['exists'])
        self.assertEqual(self.client.get('/resume/documents/current', params={'piSessionId': sid}).json()['conversationId'], conv)
        self.assertEqual(self.client.get('/resume/documents/private/preview?revision=1').status_code, 404)
        self.assertEqual(self.client.get('/resume/documents/current?piSessionId=../../private').status_code, 400)
        empty_sid = 'aaaaaaaa-1234-1234-1234-123456789abc'
        self.assertFalse(self.client.get('/resume/documents/current', params={'piSessionId': empty_sid}).json()['exists'])

    def test_png_revision_and_page_bounds_no_writes(self):
        self.add('own', 'alice')
        response = self.client.get('/resume/documents/own/preview?revision=1')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers['content-type'], 'image/png')
        self.assertTrue(response.content.startswith(b'\x89PNG'))
        for query, status in [('revision=0', 409), ('revision=1&page=2', 404), ('revision=1&page=0', 422), ('revision=1&page=101', 422)]:
            self.assertEqual(self.client.get('/resume/documents/own/preview?' + query).status_code, status)
        self.assertEqual(self.db.get(ResumeDocument, ('alice', 'own')).revision, 1)

    def test_uncompiled_revision_is_never_presented_as_current_pdf(self):
        self.add('old', 'alice', revision=2, pdf_revision=1)
        self.assertFalse(self.client.get('/resume/documents/current').json()['pdfReady'])
        self.assertEqual(self.client.get('/resume/documents/old/preview?revision=2').status_code, 404)


if __name__ == '__main__':
    unittest.main()
