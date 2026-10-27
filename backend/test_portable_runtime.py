"""Offline portable-runtime regression tests; no real .env or user DB is read."""
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest


class PortableRuntimeTests(unittest.TestCase):
    def run_isolated(self, code, data, cwd=None, extra=None):
        env = os.environ.copy()
        # Tests use synthetic credentials only. Never forward real provider secrets.
        for key in list(env):
            if key.upper() in {'DATABASE_URL', 'UPLOAD_DIR', 'SECRET_KEY', 'LLM_API_KEY', 'SEED_DEMO_DATA'}:
                env.pop(key)
        env.update(MINOS_DATA_DIR=str(data), PYTHONPATH=str(Path(__file__).resolve().parent), MINOS_DESKTOP='1')
        env.update(extra or {})
        result = subprocess.run([sys.executable, '-c', code], cwd=cwd, env=env, capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, 'Isolated portability assertion failed: ' + result.stderr)

    def test_data_env_precedence_paths_and_resources_from_unrelated_cwd(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            data = root / '中文 data'
            data.mkdir()
            (data / '.env').write_text('LLM_API_KEY=synthetic-file-key\nDATABASE_URL=sqlite:///nested/test.db\nUPLOAD_DIR=files\nMAMBO_TTS_KEY=synthetic-tts\n', encoding='utf-8')
            self.run_isolated('''
from pathlib import Path
from app.core.config import settings, Settings
from app.core.paths import DATA_DIR
from sqlalchemy.engine import make_url
assert settings.llm_api_key == 'synthetic-env-key'
assert settings.mambo_tts_key == 'synthetic-tts'
assert Path(make_url(settings.database_url).database) == DATA_DIR / 'nested/test.db'
assert Path(settings.upload_dir) == DATA_DIR / 'files'
assert Path(make_url(Settings(_env_file=None, database_url='sqlite:///:memory:').database_url).database).as_posix() == ':memory:'
from app.data import COLLEGES
assert COLLEGES
from app.services.resume_service import TEMPLATE_ROOT
assert (TEMPLATE_ROOT / 'sb2nov/LICENSE').is_file()
from app.services.workspace_tools import workspace_for
assert workspace_for('test').is_relative_to(DATA_DIR)
from app.services.pi_web_service import manager
assert manager.runtime.is_relative_to(DATA_DIR)
assert manager.root == Path(__import__('os').environ['MINOS_APP_ROOT'])
from app.db.session import engine
assert (DATA_DIR / 'nested').is_dir()
key = settings.secret_key
assert len(key) >= 32 and key != 'dev-secret-change-me'
from app.core.config import get_settings
get_settings.cache_clear()
assert get_settings().secret_key == key
engine.dispose()
''', data, cwd=root, extra={'LLM_API_KEY': 'synthetic-env-key', 'MINOS_APP_ROOT': str(root)})

    def test_clean_startup_setup_loopback_and_no_demo_users(self):
        with tempfile.TemporaryDirectory() as directory:
            self.run_isolated('''
from fastapi.testclient import TestClient
from app.main import app
from app.db.session import SessionLocal, engine
from app.models.user import User
from app.services.user_service import verify_password
from unittest.mock import patch
with TestClient(app, client=('127.0.0.1', 12345)) as client:
    assert client.get('/health').status_code == 200
    assert client.get('/api/auth/desktop-status').json() == {'setupRequired': True}
    with SessionLocal() as db:
        assert db.query(User).count() == 0
    assert client.post('/api/auth/desktop-setup', json={'username':'alice','password':'short'}).status_code == 422
    with patch.dict('os.environ', {'MINOS_DESKTOP':'0'}):
        assert client.get('/api/auth/desktop-status').status_code == 403
    assert client.post('/api/auth/desktop-setup', headers={'Origin':'https://evil.test'}, json={'username':'alice','password':'longpassword'}).status_code == 403
    assert client.post('/api/auth/desktop-setup', json={'username':'alice','password':'longpassword'}).status_code == 200
    assert client.get('/api/auth/desktop-status').json() == {'setupRequired': False}
    assert client.post('/api/auth/desktop-setup', json={'username':'bob','password':'longpassword'}).status_code == 409
    response = client.post('/api/auth/login', json={'username':'alice','password':'longpassword'})
    assert response.status_code == 200 and response.json().get('accessToken')
    with SessionLocal() as db:
        user = db.query(User).one()
        assert user.role == 'user' and user.account == 'alice'
        assert verify_password('longpassword', user.password_hash)
with TestClient(app, client=('192.0.2.1', 1)) as client:
    assert client.get('/api/auth/desktop-status').status_code == 403
engine.dispose()
''', Path(directory))

    def test_concurrent_setup_creates_exactly_one_user(self):
        with tempfile.TemporaryDirectory() as directory:
            self.run_isolated('''
from concurrent.futures import ThreadPoolExecutor
from fastapi.testclient import TestClient
from app.main import app
from app.db.session import SessionLocal, engine
from app.models.user import User
with TestClient(app, client=('127.0.0.1', 12345)) as client:
    def setup(index):
        return client.post('/api/auth/desktop-setup', json={'username':f'user{index}','password':'longpassword'}).status_code
    with ThreadPoolExecutor(2) as pool:
        assert sorted(pool.map(setup, range(2))) == [200, 409]
    with SessionLocal() as db:
        assert db.query(User).count() == 1
engine.dispose()
''', Path(directory))


if __name__ == '__main__':
    unittest.main()
