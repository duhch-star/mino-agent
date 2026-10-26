'use client';
import { useEffect, useState } from 'react';
import { AppShell } from './AppShell';
import BusinessPages from './minos/BusinessPages';
import { activateAccount } from './minos/store';
import { AUTH_EXPIRED_EVENT } from './minos/api';
import './minos-workspace.css';

type User = { id: string; name?: string; username?: string; role: string };
export function MinosWorkspace() {
  const [user, setUser] = useState<User | null>(null);
  const [connected, setConnected] = useState(false);
  const [busy, setBusy] = useState(false);
  const [permission, setPermission] = useState(false);
  const [error, setError] = useState('');
  const [path, setPath] = useState('/chat');
  const connect = async (acknowledge = false) => {
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/minos/connect', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acknowledgeLocalAgent: acknowledge }) });
      const data = await response.json();
      if (response.status === 409) { setPermission(true); return; }
      if (response.status === 401) { window.location.replace('/login'); return; }
      if (!response.ok) throw new Error(data.error?.message || data.error || '工作区连接失败');
      if (typeof data.cwd === 'string') {
        const url = new URL(window.location.href);
        if (!url.searchParams.has('cwd') && !url.searchParams.has('session')) url.searchParams.set('cwd', data.cwd);
        window.history.replaceState(null, '', url);
      }
      setPermission(false); setConnected(true);
    } catch (e) { setError(e instanceof Error ? e.message : '连接失败'); }
    finally { setBusy(false); }
  };
  useEffect(() => {
    let alive = true;
    const expired = () => window.location.replace('/login?expired=1');
    window.addEventListener(AUTH_EXPIRED_EVENT, expired);
    fetch('/api/minos/account').then(async response => {
      if (response.status === 401) { expired(); return; }
      if (!response.ok) throw new Error('暂时无法验证账号，请刷新重试');
      const account = await response.json();
      if (!alive) return;
      setUser(account.user); await activateAccount(account.user);
      const route = new URL(window.location.href).searchParams.get('businessPath');
      if (route && /^\/(knowledge|guide|interview|review|onboarding|admin\/review)(\/|$)/.test(route)) setPath(route);
      await connect();
    }).catch(e => { if (alive) setError(e.message); });
    return () => { alive = false; window.removeEventListener(AUTH_EXPIRED_EVENT, expired); };
  }, []);
  useEffect(() => {
    const navigate = (event: Event) => {
      const next = (event as CustomEvent<string>).detail;
      if (next === '/admin/review') {
        setPath(next);
        const url = new URL(window.location.href); url.searchParams.set('businessPath', next);
        window.history.replaceState(null, '', url);
        window.dispatchEvent(new PopStateEvent('popstate'));
      }
    };
    window.addEventListener('minos:account-navigate', navigate);
    return () => window.removeEventListener('minos:account-navigate', navigate);
  }, []);
  const logout = async () => {
    setConnected(false); await activateAccount(null);
    await fetch('/api/minos/account', { method: 'DELETE' }).catch(() => {});
    window.location.replace('/login');
  };
  return <div className="minos-unified-workspace">
    <header className="minos-account-bar"><strong>MINO <span>AGENT · Pi</span></strong><span>{user?.name || user?.username || '正在验证账号…'}</span>{user?.role === 'admin' && <button onClick={() => window.dispatchEvent(new CustomEvent('minos:account-navigate', { detail: '/admin/review' }))}>内容审核</button>}<button onClick={logout}>退出账号</button></header>
    {connected ? <AppShell /> : <div className="minos-offline-shell"><aside><h2>求职工作区</h2>{[['/chat','智能对话'],['/knowledge','知识库'],['/interview','AI 面试'],['/review','学习复盘'],['/onboarding','求职画像']].map(([route, label]) => <button key={route} aria-current={path === route ? 'page' : undefined} onClick={() => setPath(route)}>{label}</button>)}</aside><section>{path !== '/chat' ? <BusinessPages path={path} onNavigate={setPath} /> : <div className="minos-connect-state"><h1>Pi Agent 工作区</h1><p>账号、知识库和业务页面已统一迁入 Pi Web。</p>{error && <p role="alert">{error}</p>}<p>真实对话需在后端配置模型服务。未配置时仍可浏览知识库和学习记录。</p><button disabled={busy || !user} onClick={() => connect()}>{busy ? '正在连接…' : '重新连接 Pi Agent'}</button></div>}</section></div>}
    {permission && <div className="minos-permission-backdrop"><section role="dialog" aria-modal="true" aria-labelledby="minos-permission-title"><h2 id="minos-permission-title">启用本地 Pi Agent</h2><p>智能体可以当前 Windows 用户权限读写文件、运行命令和终端。账号目录分离不等于操作系统安全沙箱，请仅在可信本机使用。</p>{error && <p role="alert">{error}</p>}<footer><button onClick={() => setPermission(false)}>暂不启用</button><button disabled={busy} onClick={() => connect(true)}>{busy ? '正在连接…' : '我理解并启用'}</button></footer></section></div>}
  </div>;
}
