"""Per-account loopback Next sidecars. All blocking operations run in sync routes.

Secrets never travel in launch URLs or process argv. The private state directory
contains credentials and process creation identities; recovery never trusts a PID
alone. Run one backend worker (the manager's ticket store is process-local).
"""
from __future__ import annotations

import atexit
import hashlib
import json
import os
from pathlib import Path
import secrets
import shutil
import socket
import subprocess
import threading
import time
import urllib.error
import urllib.request
from dataclasses import dataclass, field

from sqlalchemy.exc import IntegrityError

from app.core.config import settings
from app.core.paths import DATA_DIR, INSTALL_ROOT
from app.core.responses import ApiException
from app.models.chat import ChatSession
from app.models.user import User
from app.services.workspace_tools import workspace_for

ROOT = Path(os.environ.get('MINOS_APP_ROOT', str(INSTALL_ROOT))).resolve()
TICKET_TTL = 60
TOKEN_TTL = 8 * 60 * 60


def _error(status: int, message: str):
    raise ApiException(status * 100, message, status_code=status)


def _private_dir(path: Path):
    path.mkdir(parents=True, exist_ok=True, mode=0o700)
    if os.name == 'nt':
        account = os.environ.get('USERDOMAIN', '') + '\\' + os.environ.get('USERNAME', '')
        subprocess.run(['icacls.exe', str(path), '/inheritance:r', '/grant:r',
                        account + ':(OI)(CI)F', '*S-1-5-18:(OI)(CI)F'],
                       check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                       creationflags=subprocess.CREATE_NO_WINDOW)
    else:
        path.chmod(0o700)


def _write_json(path: Path, data):
    temporary = path.with_suffix('.tmp')
    descriptor = os.open(str(temporary), os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(descriptor, 'w', encoding='utf-8') as target:
        json.dump(data, target, ensure_ascii=False)
    os.replace(temporary, path)


def _identity(pid: int):
    """Creation timestamp + executable; no PID-reuse based termination."""
    if os.name == 'nt':
        import ctypes
        from ctypes import wintypes
        kernel = ctypes.WinDLL('kernel32', use_last_error=True)
        kernel.OpenProcess.restype = wintypes.HANDLE
        kernel.OpenProcess.argtypes = [wintypes.DWORD, wintypes.BOOL, wintypes.DWORD]
        kernel.CloseHandle.argtypes = [wintypes.HANDLE]
        kernel.GetProcessTimes.argtypes = [wintypes.HANDLE] + [ctypes.POINTER(wintypes.FILETIME)] * 4
        kernel.QueryFullProcessImageNameW.argtypes = [wintypes.HANDLE, wintypes.DWORD, wintypes.LPWSTR, ctypes.POINTER(wintypes.DWORD)]
        kernel.TerminateProcess.argtypes = [wintypes.HANDLE, wintypes.UINT]
        handle = kernel.OpenProcess(0x1000, False, pid)
        if not handle:
            return None
        try:
            values = [wintypes.FILETIME() for _ in range(4)]
            if not kernel.GetProcessTimes(handle, *(ctypes.byref(v) for v in values)):
                return None
            size = wintypes.DWORD(32768)
            buffer = ctypes.create_unicode_buffer(size.value)
            if not kernel.QueryFullProcessImageNameW(handle, 0, buffer, ctypes.byref(size)):
                return None
            return {'startticks': str((values[0].dwHighDateTime << 32) | values[0].dwLowDateTime),
                    'executable': str(Path(buffer.value).resolve())}
        finally:
            kernel.CloseHandle(handle)
    try:
        proc = Path('/proc') / str(pid)
        stat = (proc / 'stat').read_text().rsplit(')', 1)[1].split()
        return {'startticks': stat[19], 'executable': str((proc / 'exe').resolve())}
    except (OSError, IndexError):
        return None


def _terminate_saved(record: dict, project: Path):
    """Only the exact Node process recorded under our owned private path."""
    if record.get('project') != str(project.resolve()):
        return
    pid = record.get('pid')
    if not isinstance(pid, int) or pid <= 0:
        return
    identity = _identity(pid)
    if not identity or any(identity.get(k) != record.get(k) for k in ('startticks', 'executable')):
        return
    if Path(identity['executable']).name.lower() not in ('node', 'node.exe'):
        return
    if os.name == 'nt':
        import ctypes
        from ctypes import wintypes
        kernel = ctypes.WinDLL('kernel32', use_last_error=True)
        kernel.OpenProcess.restype = wintypes.HANDLE
        kernel.OpenProcess.argtypes = [wintypes.DWORD, wintypes.BOOL, wintypes.DWORD]
        kernel.CloseHandle.argtypes = [wintypes.HANDLE]
        kernel.GetProcessTimes.argtypes = [wintypes.HANDLE] + [ctypes.POINTER(wintypes.FILETIME)] * 4
        kernel.QueryFullProcessImageNameW.argtypes = [wintypes.HANDLE, wintypes.DWORD, wintypes.LPWSTR, ctypes.POINTER(wintypes.DWORD)]
        kernel.TerminateProcess.argtypes = [wintypes.HANDLE, wintypes.UINT]
        handle = kernel.OpenProcess(0x1000 | 0x0001, False, pid)
        if handle:
            try:
                # Recheck after opening: never terminate a reused PID.
                values = [wintypes.FILETIME() for _ in range(4)]
                if kernel.GetProcessTimes(handle, *(ctypes.byref(v) for v in values)):
                    ticks = str((values[0].dwHighDateTime << 32) | values[0].dwLowDateTime)
                    if ticks == record['startticks']:
                        kernel.TerminateProcess(handle, 0)
            finally:
                kernel.CloseHandle(handle)
    else:
        # Linux pidfds prevent the check/kill PID-reuse race.
        import signal
        if hasattr(os, 'pidfd_open') and hasattr(signal, 'pidfd_send_signal'):
            try:
                descriptor = os.pidfd_open(pid)
                try:
                    if _identity(pid) == identity:
                        signal.pidfd_send_signal(descriptor, signal.SIGTERM)
                finally:
                    os.close(descriptor)
            except ProcessLookupError:
                pass


@dataclass
class Sidecar:
    user_id: str
    port: int
    secret: str
    workspace: str
    process: subprocess.Popen
    state_path: Path
    identity: dict = field(default_factory=dict)


class PiWebManager:
    def __init__(self, root: Path = ROOT, readiness_timeout: float = 90, runtime: Path | None = None):
        self.root = Path(root).resolve()
        self.project = self.root / 'pi-web'
        self.runtime = Path(runtime).resolve() if runtime is not None else DATA_DIR / 'runtime' / 'pi-web'
        self.timeout = readiness_timeout
        self.lock = threading.RLock()
        self.processes: dict[str, Sidecar] = {}
        self.tickets: dict[str, tuple[str, str, float]] = {}
        self.tokens: dict[str, tuple[str, str, float]] = {}
        self.initialized = False
        self.acknowledged: set[str] = set()

    def _initialize(self):
        if self.initialized:
            return
        _private_dir(self.runtime)
        # Recover by stopping exactly identified prior sidecars. Tickets and login
        # tokens intentionally do not survive a backend restart.
        for path in (self.runtime / 'users').glob('*/state.json'):
            try:
                record = json.loads(path.read_text(encoding='utf-8'))
                _terminate_saved(record, self.project)
                path.unlink()
            except (OSError, ValueError, TypeError):
                pass
        self.initialized = True

    def _configure(self, agent: Path):
        # ModelsConfig owns account-local Pi settings. Never overwrite user edits,
        # credentials, or even malformed files (the native editor reports those).
        if any((agent / name).exists() or (agent / name).is_symlink()
               for name in ('models.json', 'auth.json', 'settings.json')):
            return
        # A model is not a prerequisite for opening the workspace/settings UI.
        if not settings.llm_api_key or not settings.llm_base_url or not settings.llm_model:
            return
        _write_json(agent / 'models.json', {'providers': {'minos': {
            'name': 'MINOS', 'api': 'openai-completions',
            'baseUrl': settings.llm_base_url.rstrip('/'),
            'compat': {'supportsDeveloperRole': False},
            'models': [{'id': settings.llm_model, 'name': settings.llm_model,
                        'reasoning': False, 'input': ['text'],
                        'contextWindow': 128000, 'maxTokens': 8192}]}}})
        _write_json(agent / 'auth.json', {'minos': {'type': 'api_key', 'key': settings.llm_api_key}})
        path = agent / 'settings.json'
        try:
            preferences = json.loads(path.read_text(encoding='utf-8')) if path.exists() else {}
        except (OSError, ValueError):
            preferences = {}
        preferences.update(defaultProvider='minos', defaultModel=settings.llm_model)
        _write_json(path, preferences)

    def _free_port(self):
        occupied = {sidecar.port for sidecar in self.processes.values()}
        for port in range(30141, 30241):
            if port in occupied:
                continue
            with socket.socket() as listener:
                try:
                    listener.bind(('127.0.0.1', port))
                except OSError:
                    continue
                return port
        _error(503, 'Pi Web 暂无可用端口')

    def _ready(self, sidecar: Sidecar):
        deadline = time.monotonic() + self.timeout
        opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
        while time.monotonic() < deadline:
            if sidecar.process.poll() is not None:
                _error(503, 'Pi Web 启动失败，请检查生产构建')
            try:
                request = urllib.request.Request(f'http://127.0.0.1:{sidecar.port}/minos-health',
                                                 headers={'x-minos-internal': sidecar.secret})
                with opener.open(request, timeout=1) as response:
                    if response.status == 200:
                        return
            except urllib.error.HTTPError:
                pass
            except (OSError, urllib.error.URLError):
                pass
            time.sleep(0.15)
        _error(503, 'Pi Web 启动超时')

    def _start(self, user_id: str):
        self._initialize()
        node = shutil.which('node')
        entry = self.project / 'node_modules' / 'next' / 'dist' / 'bin' / 'next'
        if not node or not entry.is_file() or not (self.project / '.next' / 'BUILD_ID').is_file():
            _error(503, 'Pi Web 依赖或生产构建尚未就绪')
        digest = hashlib.sha256(user_id.encode()).hexdigest()
        private = self.runtime / 'users' / digest
        _private_dir(private)
        agent = private / 'agent'
        agent.mkdir(exist_ok=True, mode=0o700)
        self._configure(agent)
        workspace = str(workspace_for(user_id))
        port = self._free_port()
        secret = secrets.token_urlsafe(48)
        # Deliberately do not pass MINOS application/JWT/provider keys from the
        # backend environment to agent child tools. Provider auth lives in agent/.
        allowed = {'PATH', 'PATHEXT', 'SYSTEMROOT', 'WINDIR', 'TEMP', 'TMP', 'HOME',
                   'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'COMSPEC', 'LANG', 'TZ'}
        env = {key: value for key, value in os.environ.items() if key.upper() in allowed}
        env.update(PI_CODING_AGENT_DIR=str(agent), MINOS_PI_BRIDGE_SECRET=secret,
                   MINOS_PI_USER_ID=user_id, MINOS_PI_WORKSPACE=workspace,
                   MINOS_PI_COOKIE_NAME='minos_pi_' + digest[:16],
                   MINOS_API_BASE_URL=os.environ.get('MINOS_API_BASE_URL', 'http://127.0.0.1:8000'),
                   PI_WEB_ALLOWED_HOSTS='localhost,127.0.0.1,[::1]', NODE_ENV='production',
                   NEXT_TELEMETRY_DISABLED='1', PI_WEB_SKIP_VERSION_CHECK='1',
                   PI_SKIP_VERSION_CHECK='1', DO_NOT_TRACK='1', OTEL_SDK_DISABLED='true')
        command = [node, str(entry), 'start', str(self.project), '-H', '127.0.0.1', '-p', str(port)]
        try:
            # Account-private diagnostic log, never command args/bridge secrets.
            with (private / 'sidecar.log').open('ab') as output:
                process = subprocess.Popen(command, cwd=str(self.project), env=env, shell=False,
                                           stdin=subprocess.DEVNULL, stdout=output,
                                           stderr=output,
                                           creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0)
        except OSError:
            _error(503, 'Pi Web 进程启动失败')
        sidecar = Sidecar(user_id, port, secret, workspace, process, private / 'state.json',
                          _identity(process.pid) or {})
        self.processes[user_id] = sidecar
        try:
            if not sidecar.identity:
                _error(503, '无法验证 Pi Web 进程身份')
            _write_json(sidecar.state_path, {'pid': process.pid, 'port': port, 'userId': user_id,
                'project': str(self.project.resolve()), 'workspace': workspace,
                'bridgeSecret': secret, **sidecar.identity})
            self._ready(sidecar)
        except Exception:
            self.stop(user_id)
            raise
        return sidecar

    def _purge(self):
        now = time.time()
        for store in (self.tickets, self.tokens):
            for key, value in list(store.items()):
                if value[2] <= now:
                    store.pop(key, None)

    def launch(self, user_id: str, acknowledge_local_agent: bool = False):
        with self.lock:
            if acknowledge_local_agent:
                self.acknowledged.add(user_id)
            if user_id not in self.acknowledged:
                _error(409, '请先确认：本机智能体可读写文件和执行命令，不是账号安全沙箱')
            self._purge()
            sidecar = self.processes.get(user_id)
            if sidecar and sidecar.process.poll() is not None:
                self.stop(user_id)
                sidecar = None
            sidecar = sidecar or self._start(user_id)
            ticket = secrets.token_urlsafe(32)
            self.tickets[ticket] = (user_id, sidecar.secret, time.time() + TICKET_TTL)
            commit_file = self.project / 'UPSTREAM_COMMIT'
            commit = commit_file.read_text(encoding='utf-8').strip() if commit_file.is_file() else 'e533d9b3975f8a74b378d5007c92fdf4d15d3fba'
            return {'url': f'http://127.0.0.1:{sidecar.port}/minos-connect?ticket={ticket}',
                    'port': sidecar.port, 'upstreamCommit': commit}

    def verify(self, db, *, bridge_secret: str, ticket: str | None = None, token: str | None = None):
        with self.lock:
            self._purge()
            if bool(ticket) == bool(token):
                _error(401, '无效 Pi Web 凭据')
            record = (self.tickets if ticket else self.tokens).get(ticket or token)
            if not record:
                _error(401, 'Pi Web 凭据已失效')
            user_id, expected, expiry = record
            sidecar = self.processes.get(user_id)
            if (not secrets.compare_digest(expected, bridge_secret) or not sidecar
                    or not secrets.compare_digest(sidecar.secret, bridge_secret)
                    or sidecar.process.poll() is not None):
                _error(401, '无效 Pi Web 凭据')
            user = db.get(User, user_id, populate_existing=True)
            if not user or not user.is_active:
                _error(401, '用户不存在或已禁用')
            if ticket:
                self.tickets.pop(ticket)
                token = secrets.token_urlsafe(48)
                expiry = time.time() + TOKEN_TTL
                self.tokens[token] = (user_id, expected, expiry)
            return {'userId': user_id, 'token': token, 'expiresAt': int(expiry * 1000),
                    'workspace': sidecar.workspace}

    def resume_tool(self, db, *, token: str, bridge_secret: str, pi_session_id: str, name: str, arguments: dict):
        from uuid import UUID
        from app.services import resume_document_service
        identity = self.verify(db, token=token, bridge_secret=bridge_secret)
        try:
            normalized = str(UUID(pi_session_id))
        except (ValueError, AttributeError):
            _error(400, '无效 Pi 会话 ID')
        if name not in {tool['function']['name'] for tool in resume_document_service.TOOLS}:
            _error(400, '无效简历工具')
        # Include account in the hash because ChatSession.id is globally unique.
        conversation_id = 'conv_pi_' + hashlib.sha256((identity['userId'] + ':' + normalized).encode()).hexdigest()[:24]
        row = db.get(ChatSession, conversation_id)
        if row and row.user_id != identity['userId']:
            _error(403, '会话所有权不匹配')
        if not row:
            db.add(ChatSession(id=conversation_id, user_id=identity['userId'], title='Pi Web 简历'))
            try:
                db.commit()
            except IntegrityError:
                db.rollback()
                row = db.get(ChatSession, conversation_id)
                if not row or row.user_id != identity['userId']:
                    _error(403, '会话所有权不匹配')
        return resume_document_service.execute_tool(db, identity['userId'], conversation_id, name, arguments)

    def resume_pdf(self, db, *, token: str, bridge_secret: str, pi_session_id: str, revision: int):
        from uuid import UUID
        from app.services import resume_document_service
        identity = self.verify(db, token=token, bridge_secret=bridge_secret)
        try:
            normalized = str(UUID(pi_session_id))
        except (ValueError, AttributeError):
            _error(400, '无效 Pi 会话 ID')
        conversation_id = 'conv_pi_' + hashlib.sha256((identity['userId'] + ':' + normalized).encode()).hexdigest()[:24]
        return resume_document_service.read_pdf(db, identity['userId'], conversation_id, revision)

    def stop(self, user_id: str):
        with self.lock:
            sidecar = self.processes.pop(user_id, None)
            for store in (self.tickets, self.tokens):
                for key, value in list(store.items()):
                    if value[0] == user_id:
                        store.pop(key, None)
            if sidecar:
                if sidecar.process.poll() is None:
                    # Popen's owned process handle is safe against PID reuse.
                    sidecar.process.terminate()
                    try:
                        sidecar.process.wait(timeout=5)
                    except subprocess.TimeoutExpired:
                        sidecar.process.kill()
                        sidecar.process.wait(timeout=5)
                sidecar.state_path.unlink(missing_ok=True)
            return {'ok': True}

    def shutdown(self):
        for user_id in list(self.processes):
            try:
                self.stop(user_id)
            except OSError:
                pass


manager = PiWebManager()
atexit.register(manager.shutdown)
