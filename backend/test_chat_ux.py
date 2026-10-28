import json
import unittest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from app.db.session import Base
from app.models.chat import ChatSession, ChatMessage, ResumeDocument
from app.services import chat_service
from app.core.responses import ApiException
from app.api.deps import get_optional_user


class ChatUxTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine('sqlite:///:memory:')
        Base.metadata.create_all(self.engine)
        self.db = Session(self.engine)
        self.db.add(ChatSession(id='parent', user_id='alice', title='original'))
        self.db.commit()
        for index, (role, content) in enumerate([('user', 'keep this context'), ('assistant', 'second item'), ('user', 'exclude this later message')]):
            meta = {'toolCalls': [{'status': 'completed', 'output': {'resume': {'name': 'Alice', 'contact': '', 'summary': '', 'sections': []}, 'template': 'classic', 'revision': 3}}]} if index == 1 else {}
            from datetime import datetime, timedelta
            self.db.add(ChatMessage(id=f'm{index}',session_id='parent',role=role,content=content,meta_json=json.dumps(meta),created_at=datetime(2020,1,1)+timedelta(seconds=index)))
        self.db.commit()

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def test_branch_copies_only_until_target_and_context(self):
        branch=chat_service.create_session(self.db,'alice',{'parentSessionId':'parent','branchMessageId':'m1'})
        messages=chat_service.list_messages(self.db,'alice',branch['id'])['items']
        self.assertEqual([m['content'] for m in messages],['keep this context','second item'])
        self.assertTrue(all(m['id'] not in ['m0','m1'] for m in messages))
        history=chat_service._chat_history(self.db,'alice',branch['id'],'system','continue second item')
        self.assertTrue(any(m['content']=='second item' for m in history))
        resume=self.db.query(ResumeDocument).filter_by(conversation_id=branch['id']).one()
        self.assertEqual(json.loads(resume.resume_json)['name'],'Alice')
        chat_service.delete_session(self.db,'alice',branch['id'])
        self.assertEqual(self.db.query(ResumeDocument).count(),0)

    def test_branch_ownership_and_missing_target(self):
        for user,target in [('bob','m1'),('alice','absent'),('','m1')]:
            with self.assertRaises(ApiException):
                chat_service.create_session(self.db,user,{'parentSessionId':'parent','branchMessageId':target})
        self.assertEqual(self.db.query(ChatSession).count(),1)

    def test_invalid_auth_is_not_silent_guest(self):
        self.assertIsNone(get_optional_user('',self.db))
        with self.assertRaises(ApiException) as context:
            get_optional_user('Bearer invalid-token',self.db)
        self.assertEqual(context.exception.status_code,401)

if __name__ == '__main__': unittest.main()
