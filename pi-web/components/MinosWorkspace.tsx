'use client';
import { useEffect, useRef, useState } from 'react';
import { ModelsConfig } from './ModelsConfig';
import { CareerExamples } from './CareerExamples';
import { MinosAccountPanel } from './MinosAccountPanel';
import { AppShell } from './AppShell';
import BusinessPages from './minos/BusinessPages';
import { activateAccount } from './minos/store';
import { AUTH_EXPIRED_EVENT } from './minos/api';
import './minos-workspace.css';
import './minos-welcome.css';

type User = { id: string; name?: string; username?: string; role: string };
export function MinosWorkspace() {
  const [user, setUser] = useState<User | null>(null);
  const [connected, setConnected] = useState(false);
  const [busy, setBusy] = useState(false);
  const [permission, setPermission] = useState(false);
  const [error, setError] = useState('');
  const [path, setPath] = useState('/chat');
  const [configuration, setConfiguration] = useState(false);
  const [accountPanel, setAccountPanel] = useState(false);
  const browse = () => { setPermission(false); setError(''); };
  const configuring = useRef(false);
  const configure = () => {
    configuring.current = true;
    if (connected) setConfiguration(true);
    else void connect();
  };
  const connecting = useRef(false);
  const connect = async (acknowledge = false, promptPermission = true) => {
    if (connecting.current) return;
    connecting.current = true;
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/minos/connect', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acknowledgeLocalAgent: acknowledge }) });
      const data = await response.json();
      if (response.status === 409) { if (promptPermission) setPermission(true); return; }
      if (response.status === 401) { window.location.replace('/login'); return; }
      if (!response.ok) throw new Error(data.error?.message || data.error || '工作区连接失败');
      if (typeof data.cwd === 'string') {
        const url = new URL(window.location.href);
        if (!url.searchParams.has('cwd') && !url.searchParams.has('session')) url.searchParams.set('cwd', data.cwd);
        window.history.replaceState(null, '', url);
      }
      setPermission(false); setConnected(true);
      if (configuring.current) { setConfiguration(true); configuring.current = false; }
    } catch (e) { setError(e instanceof Error ? e.message : '连接失败'); }
    finally { connecting.current = false; setBusy(false); }
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
      // Entry is never gated by local-agent consent or a configured model.
      // Reconnect previously authorized sessions silently; ask only on explicit enable.
      await connect(false, false);
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
  useEffect(() => {
    const dismiss = (event: PointerEvent) => {
      if (event.target instanceof Element && !event.target.closest('.minos-account-menu')) {
        document.querySelector<HTMLDetailsElement>('.minos-account-menu')?.removeAttribute('open');
      }
    };
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, []);
  const logout = async () => {
    setConnected(false); await activateAccount(null);
    await fetch('/api/minos/account', { method: 'DELETE' }).catch(() => {});
    window.location.replace('/login');
  };
  return <div className="minos-unified-workspace">
    <header className="minos-account-bar" aria-label="账号与模型"><strong>MINOS</strong><button onClick={configure}>模型设置</button><details className="minos-account-menu" onKeyDown={event => { if (event.key === 'Escape') { event.currentTarget.open = false; event.currentTarget.querySelector('summary')?.focus(); } }}><summary title={user?.name || user?.username || '账号菜单'} aria-label="账号菜单"><span className="minos-account-avatar" aria-hidden="true">{(user?.name || user?.username || 'M').slice(0, 1).toUpperCase()}</span><span className="minos-account-name">{user?.name || user?.username || '正在验证账号…'}</span><span aria-hidden="true">⌄</span></summary><div className="minos-account-dropdown"><span className="minos-account-caption">当前账号</span><strong>{user?.name || user?.username || '正在验证账号…'}</strong>{user?.role === 'admin' && <button onClick={() => { window.dispatchEvent(new CustomEvent('minos:account-navigate', { detail: '/admin/review' })); document.querySelector<HTMLDetailsElement>('.minos-account-menu')?.removeAttribute('open'); }}>内容审核</button>}<button disabled={!user} onClick={() => { setAccountPanel(true); document.querySelector<HTMLDetailsElement>('.minos-account-menu')?.removeAttribute('open'); }}>账号与数据</button><button onClick={logout}>退出账号</button></div></details></header>
    {connected ? <AppShell /> : <div className="minos-offline-shell"><aside><h2>求职工作区</h2>{[['/chat','智能对话'],['/knowledge','知识库'],['/interview','AI 面试'],['/review','学习复盘'],['/onboarding','求职画像']].map(([route, label]) => <button key={route} aria-current={path === route ? 'page' : undefined} onClick={() => setPath(route)}>{label}</button>)}</aside><section>{path !== '/chat' ? <BusinessPages path={path} onNavigate={setPath} /> : <div className="minos-connect-state minos-welcome">
      <div className="minos-welcome-eyebrow"><span /> YOUR NEXT CHAPTER</div>
      <div className="minos-welcome-hero"><div><h1>下一步，<br/><em>更接近理想。</em></h1><p>从一次对话、一份准备开始。<br/>让每一步求职，都有清晰的方向。</p><div className="minos-welcome-actions"><button className="minos-primary" disabled={busy || !user} onClick={configure}>{busy ? '正在准备工作区…' : '配置模型，开始对话'}<span>↗</span></button><button onClick={() => setPath('/knowledge')}>先逛逛知识库 →</button></div></div><div className="minos-welcome-art" aria-hidden="true"><div className="minos-orbit"/><img src="/icons/minos-avatar.svg" alt=""/><span>MINOS · 为下一步而准备</span></div></div>
      {error && <p role="alert">{error}</p>}
      <div className="minos-welcome-rule"><span>你的求职工作台</span><small>无需模型，也可以从这里开始</small></div>
      <div className="minos-quick-grid">{[['01','知识库','把零散的信息，变成准备。','/knowledge'],['02','AI 面试','提前练习，让表达更从容。','/interview'],['03','学习复盘','看见积累，也看见下一步。','/review']].map(([n,title,desc,route]) => <button key={route} onClick={() => setPath(route)}><span className="minos-quick-index">{n} <span>↗</span></span><strong>{title}</strong><p>{desc}</p></button>)}</div>
      <CareerExamples onConfigure={configure} />
    </div>}</section></div>}
    {accountPanel && user && <MinosAccountPanel user={user} onClose={() => setAccountPanel(false)} />}
    {configuration && <div className="minos-model-settings"><ModelsConfig onClose={() => setConfiguration(false)} /></div>}
    {permission && <div className="minos-permission-backdrop"><section role="dialog" aria-modal="true" aria-labelledby="minos-permission-title"><h2 id="minos-permission-title">启用本地 MINOS 智能体</h2><p>智能体可以当前 Windows 用户权限读写文件、运行命令和终端。账号目录分离不等于操作系统安全沙箱，请仅在可信本机使用。</p>{error && <p role="alert">{error}</p>}<footer><button onClick={browse}>稍后启用，继续浏览</button><button onClick={configure}>去配置模型</button><button disabled={busy} onClick={() => connect(true)}>{busy ? '正在连接…' : '我理解并启用'}</button></footer></section></div>}
  </div>;
}
