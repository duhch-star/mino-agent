"""Offline sidecar regression tests: never start Node or touch ~/.pi."""
import hashlib
import json
from pathlib import Path
import tempfile
import unittest
from types import SimpleNamespace
from unittest.mock import Mock, patch
from urllib.parse import parse_qs, urlparse

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.responses import ApiException, api_exception_handler
from app.db.session import Base, get_db
from app.models.chat import ChatSession
from app.models.user import User
from app.routers_fe.pi_web import router
from app.routers_fe.utils import get_fe_user
from app.services import pi_web_service as service


class PiWebTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.manager = service.PiWebManager(self.root, runtime=self.root / '.runtime' / 'pi-web')
        self.engine = create_engine('sqlite:///' + str(self.root / 'test.db'), connect_args={'check_same_thread': False})
        Base.metadata.create_all(self.engine, tables=[User.__table__, ChatSession.__table__])
        self.db = sessionmaker(self.engine, expire_on_commit=False)()
        self.db.add_all([User(id='alice', account='alice', password_hash='x', is_active=True),
                         User(id='bob', account='bob', password_hash='x', is_active=True)])
        self.db.commit()
        self.spawns = []

        def spawn(user):
            process = Mock(pid=123)
            process.poll.return_value = None
            item = service.Sidecar(user, 30141 + len(self.spawns), 'secret-' + user,
                                   str(self.root / user), process, self.root / (user + '.json'))
            self.manager.processes[user] = item
            self.spawns.append(item)
            return item
        self.spawn = patch.object(self.manager, '_start', side_effect=spawn)
        self.spawn.start()

    def tearDown(self):
        self.spawn.stop()
        self.manager.shutdown()
        self.db.close()
        self.engine.dispose()
        self.temp.cleanup()

    def ticket(self, user='alice'):
        launch = self.manager.launch(user, acknowledge_local_agent=True)
        return parse_qs(urlparse(launch['url']).query)['ticket'][0]

    def login(self, user='alice'):
        return self.manager.verify(self.db, ticket=self.ticket(user), bridge_secret='secret-' + user)

    def test_empty_model_does_not_block_settings(self):
        agent = self.root / 'empty-agent'
        agent.mkdir()
        with patch.object(service, 'settings', SimpleNamespace(llm_api_key='', llm_base_url='', llm_model='')):
            self.manager._configure(agent)
        self.assertFalse((agent / 'models.json').exists())

    def test_existing_pi_config_is_never_overwritten(self):
        agent = self.root / 'configured-agent'
        agent.mkdir()
        for name in ('models.json', 'auth.json', 'settings.json'):
            (agent / name).write_text('user-owned-' + name)
        with patch.object(service, 'settings', SimpleNamespace(llm_api_key='server-key', llm_base_url='https://example.test', llm_model='server-model')):
            self.manager._configure(agent)
        for name in ('models.json', 'auth.json', 'settings.json'):
            self.assertEqual((agent / name).read_text(), 'user-owned-' + name)

    def test_ack_required_and_single_process(self):
        with self.assertRaises(ApiException) as exc:
            self.manager.launch('alice')
        self.assertEqual(exc.exception.status_code, 409)
        a, b = self.ticket(), self.ticket()
        self.assertNotEqual(a, b)
        self.assertEqual(len(self.spawns), 1)

    def test_ticket_one_use_bridge_isolation_and_token_ttl(self):
        ticket = self.ticket()
        self.ticket('bob')
        with self.assertRaises(ApiException):
            self.manager.verify(self.db, ticket=ticket, bridge_secret='secret-bob')
        result = self.manager.verify(self.db, ticket=ticket, bridge_secret='secret-alice')
        self.assertEqual(result['userId'], 'alice')
        with self.assertRaises(ApiException):
            self.manager.verify(self.db, ticket=ticket, bridge_secret='secret-alice')
        with self.assertRaises(ApiException):
            self.manager.verify(self.db, token=result['token'], bridge_secret='secret-bob')
        self.assertEqual(self.manager.verify(self.db, token=result['token'], bridge_secret='secret-alice'), result)
        with patch.object(service.time, 'time', return_value=result['expiresAt'] / 1000 + 1):
            with self.assertRaises(ApiException):
                self.manager.verify(self.db, token=result['token'], bridge_secret='secret-alice')

    def test_parallel_ticket_consumption_is_atomic(self):
        from concurrent.futures import ThreadPoolExecutor
        ticket = self.ticket()
        # DB stand-in avoids sharing a real Session across concurrent threads.
        db = Mock()
        db.get.return_value = SimpleNamespace(is_active=True)
        def consume(_):
            try:
                self.manager.verify(db, ticket=ticket, bridge_secret='secret-alice')
                return True
            except ApiException:
                return False
        with ThreadPoolExecutor(max_workers=6) as executor:
            self.assertEqual(sum(executor.map(consume, range(12))), 1)

    def test_expired_ticket_and_deleted_disabled_user(self):
        ticket = self.ticket()
        with patch.object(service.time, 'time', return_value=service.time.time() + 61):
            with self.assertRaises(ApiException):
                self.manager.verify(self.db, ticket=ticket, bridge_secret='secret-alice')
        result = self.login()
        user = self.db.get(User, 'alice')
        user.is_active = False
        self.db.commit()
        with self.assertRaises(ApiException):
            self.manager.verify(self.db, token=result['token'], bridge_secret='secret-alice')
        self.db.delete(user)
        self.db.commit()
        with self.assertRaises(ApiException):
            self.manager.verify(self.db, token=result['token'], bridge_secret='secret-alice')

    def test_stop_only_owned_user_preserves_data(self):
        a, b = self.login(), self.login('bob')
        data = self.root / 'resume.txt'
        data.write_text('keep')
        self.manager.stop('alice')
        self.spawns[0].process.terminate.assert_called_once()
        self.spawns[1].process.terminate.assert_not_called()
        self.assertEqual(data.read_text(), 'keep')
        with self.assertRaises(ApiException):
            self.manager.verify(self.db, token=a['token'], bridge_secret='secret-alice')
        self.manager.verify(self.db, token=b['token'], bridge_secret='secret-bob')

    def test_resume_mapping_per_user_and_uuid_validation(self):
        session = '93f0d256-4764-45e1-827b-57cbaf4b1111'
        with patch('app.services.resume_document_service.execute_tool', return_value={'revision': 1}) as execute:
            for user in ('alice', 'bob'):
                token = self.login(user)['token']
                result = self.manager.resume_tool(self.db, token=token, bridge_secret='secret-' + user,
                    pi_session_id=session, name='resume_read', arguments={})
                self.assertEqual(result, {'revision': 1})
            ids = [call.args[2] for call in execute.call_args_list]
            self.assertNotEqual(*ids)
            self.assertTrue(all(len(value) <= 40 for value in ids))
            self.assertEqual(self.db.get(ChatSession, ids[0]).user_id, 'alice')
            with self.assertRaises(ApiException):
                self.manager.resume_tool(self.db, token=token, bridge_secret='secret-bob',
                    pi_session_id='../bad', name='resume_read', arguments={})

    def test_real_spawn_contract_model_config_and_no_env_key_leak(self):
        self.spawn.stop()
        self.manager.initialized = True
        project = self.root / 'pi-web'
        (project / 'node_modules/next/dist/bin').mkdir(parents=True)
        (project / 'node_modules/next/dist/bin/next').touch()
        (project / '.next').mkdir()
        (project / '.next/BUILD_ID').write_text('production')
        process = Mock(pid=123)
        process.poll.return_value = None
        config = SimpleNamespace(llm_api_key='private-api-key', llm_base_url='https://example.invalid/v1', llm_model='deepseek-chat')
        with patch.object(service, '_private_dir', side_effect=lambda p: p.mkdir(parents=True, exist_ok=True)), \
             patch.object(service, 'settings', config), patch.object(service, 'workspace_for', return_value=self.root), \
             patch.object(service.shutil, 'which', return_value='node.exe'), \
             patch.object(service, '_identity', return_value={'startticks': '123', 'executable': 'node.exe'}), \
             patch.object(service.subprocess, 'Popen', return_value=process) as popen, \
             patch.object(self.manager, '_ready'), patch.dict(service.os.environ, {'SECRET_KEY': 'do-not-inherit'}):
            self.manager.launch('alice', True)
        args, kwargs = popen.call_args
        self.assertFalse(kwargs['shell'])
        self.assertEqual(kwargs['cwd'], str(project))
        self.assertEqual(kwargs['env']['MINOS_PI_WORKSPACE'], str(self.root))
        self.assertIn(str(project), args[0])
        self.assertEqual(args[0][-4:-2], ['-H', '127.0.0.1'])
        env = kwargs['env']
        self.assertNotIn('SECRET_KEY', env)
        self.assertNotIn('private-api-key', str(env))
        agent = Path(env['PI_CODING_AGENT_DIR'])
        self.assertIn(hashlib.sha256(b'alice').hexdigest(), str(agent))
        self.assertEqual(json.loads((agent / 'auth.json').read_text())['minos']['key'], 'private-api-key')
        self.assertEqual(json.loads((agent / 'settings.json').read_text())['defaultProvider'], 'minos')

    def test_routes_require_auth_and_bridge(self):
        app = FastAPI()
        app.add_exception_handler(ApiException, api_exception_handler)
        app.include_router(router, prefix='/api')
        app.dependency_overrides[get_db] = lambda: self.db
        with patch('app.routers_fe.pi_web.manager', self.manager):
            client = TestClient(app)
            self.assertEqual(client.get('/api/pi-web/launch').status_code, 401)
            self.assertEqual(client.post('/api/pi-web/stop').status_code, 401)
            app.dependency_overrides[get_fe_user] = lambda: self.db.get(User, 'alice')
            self.assertEqual(client.get('/api/pi-web/launch').status_code, 409)
            launched = client.post('/api/pi-web/launch', json={'acknowledgeLocalAgent': True})
            self.assertEqual(launched.status_code, 200)
            ticket = parse_qs(urlparse(launched.json()['url']).query)['ticket'][0]
            self.assertEqual(client.post('/api/pi-web/verify', json={'ticket': ticket, 'bridgeSecret': 'wrong'}).status_code, 401)
            self.assertEqual(client.post('/api/pi-web/verify', json={'ticket': ticket, 'bridgeSecret': 'secret-alice'}).status_code, 200)
            self.assertEqual(client.post('/api/pi-web/verify', json={'ticket': ticket, 'token': 'both', 'bridgeSecret': 'secret-alice'}).status_code, 422)

    def test_recovery_rejects_pid_reuse_or_unowned_path(self):
        record = {'pid': 555, 'project': str(self.manager.project), 'startticks': 'old', 'executable': 'node.exe'}
        with patch.object(service, '_identity', return_value={'startticks': 'new', 'executable': 'node.exe'}), \
             patch.object(service.os, 'name', 'nt'), patch('ctypes.WinDLL', create=True) as win:
            service._terminate_saved(record, self.manager.project)
            win.assert_not_called()


if __name__ == '__main__':
    unittest.main()
