import { NextRequest, NextResponse } from 'next/server';
import { accountRequest, backendFetch, cookieSessionId, createAccount, deleteAccount, GATEWAY_COOKIE, gatewayEnabled, loadAccount } from '@/lib/minos-gateway';
import { getAuthRetryAfterMs, recordAuthFailure, recordAuthSuccess, retryAfterSeconds } from '@/lib/auth-throttle';

export async function GET(request: NextRequest) {
  if (!gatewayEnabled()) return NextResponse.json({ error: 'Not available' }, { status: 404 });
  const id = cookieSessionId(request.headers.get('cookie'));
  const session = await loadAccount(id);
  if (!session || !id) return NextResponse.json({ error: '请登录 MINO AGENT' }, { status: 401 });
  const current = await accountRequest(id, '/api/users/me');
  if (!current.ok) return NextResponse.json({ error: '登录已失效，请重新登录' }, { status: current.status });
  const data = await current.json();
  return NextResponse.json({ user: data.user || data, connected: Boolean(session.sidecar) }, { headers: { 'Cache-Control': 'no-store' } });
}
export async function POST(request: NextRequest) {
  if (!gatewayEnabled()) return NextResponse.json({ error: 'Not available' }, { status: 404 });
  const retry = getAuthRetryAfterMs();
  if (retry > 0) return NextResponse.json({ error: '尝试过于频繁，请稍后重试' }, { status: 429, headers: { 'Retry-After': String(retryAfterSeconds(retry)) } });
  try {
    const { username, password } = await request.json();
    if (typeof username !== 'string' || typeof password !== 'string' || !username.trim() || username.length > 120 || !password || password.length > 64) return NextResponse.json({ error: '请填写有效的账号和密码' }, { status: 400 });
    const response = await backendFetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: username.trim(), password }) });
    if (!response.ok) { recordAuthFailure(); return NextResponse.json({ error: response.status === 401 ? '账号或密码错误' : '登录失败，请检查后端服务' }, { status: response.status }); }
    const result = await response.json();
    const old = cookieSessionId(request.headers.get('cookie'));
    if (old) await deleteAccount(old);
    const id = await createAccount({ accessToken: result.accessToken, refreshToken: result.refreshToken, user: result.user, expiresAt: Date.now() + 8 * 60 * 60 * 1000 });
    recordAuthSuccess();
    const reply = NextResponse.json({ user: result.user });
    reply.cookies.set(GATEWAY_COOKIE, id, { httpOnly: true, sameSite: 'strict', path: '/', maxAge: 8 * 60 * 60, secure: request.nextUrl.protocol === 'https:' });
    return reply;
  } catch { return NextResponse.json({ error: '无法连接业务后端，请稍后重试' }, { status: 502 }); }
}
export async function DELETE(request: NextRequest) {
  const id = cookieSessionId(request.headers.get('cookie'));
  if (id) {
    const session = await loadAccount(id);
    // Account cookies are separate from the sidecar capability. Logout invalidates
    // this browser session, without killing another browser's active agent run.
    if (session) await backendFetch('/api/auth/logout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh_token: session.refreshToken }) }).catch(() => {});
    await deleteAccount(id);
  }
  const response = NextResponse.json({ ok: true });
  response.cookies.set(GATEWAY_COOKIE, '', { httpOnly: true, sameSite: 'strict', path: '/', maxAge: 0 });
  return response;
}
