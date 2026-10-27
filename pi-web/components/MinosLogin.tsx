'use client';
import Image from 'next/image';
import { useEffect, useState, type FormEvent } from 'react';
export function MinosLogin() {
  const [setupRequired, setSetupRequired] = useState(false);
  useEffect(() => { fetch('/api/minos/setup').then(r => r.json()).then(data => setSetupRequired(data.setupRequired === true)).catch(() => {}); }, []);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('user');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const submit = async (event: FormEvent) => {
    event.preventDefault(); if (pending) return;
    setPending(true); setError('');
    try {
      if (setupRequired) {
        const created = await fetch('/api/minos/setup', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({username:username.trim(),password}) });
        const data = await created.json();
        if (!created.ok) throw new Error(typeof data.error === 'string' ? data.error : '创建账号失败');
        setSetupRequired(false);
      }
      const response = await fetch('/api/minos/account', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: username.trim(), password }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || '登录失败');
      window.location.replace(result.user.role === 'admin' ? '/?businessPath=%2Fadmin%2Freview' : '/');
    } catch (e) { setError(e instanceof Error ? e.message : '连接失败'); }
    finally { setPending(false); }
  };
  return <main className="web-login-page"><div className="web-login-shell"><header className="web-login-brand"><Image src="/icons/minos-avatar.svg" width={52} height={52} alt="" priority /><div><h1>MINOS</h1><p>{setupRequired ? '首次使用 · 创建本机账号' : '登录统一求职工作区'}</p></div></header><form className="web-login-form" onSubmit={submit}><div style={{ display:setupRequired ? 'none' : 'flex', gap:8, marginBottom:18 }}>{[['user','求职者'],['admin','管理员']].map(([id,label]) => <button type="button" key={id} aria-pressed={role === id} onClick={() => setRole(id)} style={{ flex:1, padding:8, border:'1px solid var(--border)', borderRadius:6, color:role === id ? 'var(--accent)' : 'var(--text-muted)', background:role === id ? 'var(--bg-selected)' : 'var(--bg)' }}>{label}</button>)}</div><div className="web-login-composer" style={{ flexDirection:'column', alignItems:'stretch', gap:12 }}><label className="web-login-label" htmlFor="minos-username">账号</label><input id="minos-username" name="username" autoComplete="username" placeholder={role === 'admin' ? '管理员账号' : '邮箱 / 手机号 / 用户名'} value={username} onChange={e => setUsername(e.target.value)} required disabled={pending} autoFocus /><label className="web-login-label" htmlFor="minos-password">密码</label><input id="minos-password" name="password" type="password" minLength={setupRequired ? 8 : 1} maxLength={64} autoComplete={setupRequired ? 'new-password' : 'current-password'} value={password} onChange={e => setPassword(e.target.value)} required disabled={pending} placeholder="请输入密码" /><button type="submit" disabled={pending || !username.trim() || !password}>{pending ? '请稍候…' : setupRequired ? '创建账号并进入' : '登录工作区'}</button></div><p className="web-login-error" role="alert" aria-live="polite">{error}</p><p style={{ fontSize:12, color:'var(--text-muted)', lineHeight:1.8 }}>角色以服务端授权为准。账号凭据由服务器管理，不写入浏览器本地存储。本机智能体权限将在登录后单独确认。</p></form></div></main>;
}
