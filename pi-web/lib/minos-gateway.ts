/** Server-only account gateway. Credentials never enter browser storage. */
import { randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile, unlink, rename } from 'node:fs/promises';
import { resolve, join } from 'node:path';

export const GATEWAY_COOKIE = 'minos_account';
export const gatewayEnabled = () => process.env.MINOS_GATEWAY === '1';
const backend = () => process.env.MINOS_API_BASE_URL || 'http://127.0.0.1:8000';
const directory = () => resolve(process.env.MINOS_GATEWAY_SESSION_DIR || '../.runtime/gateway-sessions');
export type AccountSession = {
  accessToken: string; refreshToken: string; expiresAt: number;
  user: { id: string; name?: string; username?: string; role: string };
  sidecar?: { port: number; cookie: string };
};
const locks = new Map<string, Promise<unknown>>();
export async function backendFetch(path: string, init?: RequestInit) {
  return fetch(`${backend()}${path}`, { ...init, cache: 'no-store', redirect: 'manual', signal: init?.signal || AbortSignal.timeout(30000) });
}
export function cookieSessionId(cookie: string | null): string | null {
  const value = cookie?.split(';').map(p => p.trim()).find(p => p.startsWith(`${GATEWAY_COOKIE}=`))?.slice(GATEWAY_COOKIE.length + 1);
  return value && /^[a-f0-9]{64}$/.test(value) ? value : null;
}
export async function loadAccount(id: string | null): Promise<AccountSession | null> {
  if (!id || !/^[a-f0-9]{64}$/.test(id)) return null;
  try {
    const session = JSON.parse(await readFile(join(directory(), id + '.json'), 'utf8')) as AccountSession;
    if (session.expiresAt <= Date.now()) { await deleteAccount(id); return null; }
    return session;
  } catch { return null; }
}
export async function saveAccount(id: string, session: AccountSession) {
  if (!/^[a-f0-9]{64}$/.test(id)) throw new Error('Invalid session');
  await mkdir(directory(), { recursive: true, mode: 0o700 });
  const target = join(directory(), id + '.json');
  const temporary = target + '.' + randomBytes(8).toString('hex') + '.tmp';
  try {
    await writeFile(temporary, JSON.stringify(session), { mode: 0o600 });
    await rename(temporary, target);
  } finally { await unlink(temporary).catch(() => {}); }
}
export async function createAccount(session: AccountSession) {
  const id = randomBytes(32).toString('hex');
  await saveAccount(id, session);
  return id;
}
export async function deleteAccount(id: string) {
  if (/^[a-f0-9]{64}$/.test(id)) await unlink(join(directory(), id + '.json')).catch(() => {});
}
export async function accountRequest(id: string, path: string, init: RequestInit = {}) {
  const session = await loadAccount(id);
  if (!session) return new Response('Authentication required', { status: 401 });
  const send = (token: string) => backendFetch(path, { ...init, headers: { ...Object.fromEntries(new Headers(init.headers)), Authorization: `Bearer ${token}` } });
  const response = await send(session.accessToken);
  if (response.status !== 401) return response;
  await response.body?.cancel();
  // Only credential rotation is serialized. Slow TTS must not block learning or UI requests.
  const previous = locks.get(id) || Promise.resolve();
  const task = previous.catch(() => {}).then(async () => {
    const current = await loadAccount(id);
    if (!current) return null;
    if (current.accessToken !== session.accessToken) return current;
    const refresh = await backendFetch('/api/auth/refresh', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh_token: current.refreshToken }) });
    if (!refresh.ok) { await deleteAccount(id); return null; }
    const tokens = await refresh.json();
    // A logout while the network request was in flight must not recreate its session.
    const latest = await loadAccount(id);
    if (!latest) return null;
    latest.accessToken = tokens.accessToken; latest.refreshToken = tokens.refreshToken;
    await saveAccount(id, latest);
    return latest;
  });
  locks.set(id, task);
  let refreshed: AccountSession | null;
  try { refreshed = await task; } finally { if (locks.get(id) === task) locks.delete(id); }
  if (!refreshed) return new Response('Authentication required', { status: 401 });
  return send(refreshed.accessToken);
}
export async function connectAccount(id: string, acknowledge: boolean) {
  const launch = await accountRequest(id, '/api/pi-web/launch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acknowledgeLocalAgent: acknowledge }), signal: AbortSignal.timeout(120000) });
  if (!launch.ok) return launch;
  const result = await launch.json();
  const url = new URL(result.url);
  if (url.hostname !== '127.0.0.1' || !Number.isInteger(result.port) || result.port < 30141 || result.port > 30240 || Number(url.port) !== result.port) throw new Error('Invalid Pi endpoint');
  const connected = await fetch(url, { redirect: 'manual', cache: 'no-store', signal: AbortSignal.timeout(30000) });
  const cookie = connected.headers.get('set-cookie')?.split(';')[0];
  if (connected.status !== 307 || !cookie || !/^minos_pi_[a-f0-9]+=/.test(cookie)) throw new Error('Pi connection failed');
  const session = await loadAccount(id);
  if (!session) return new Response('Authentication required', { status: 401 });
  session.sidecar = { port: result.port, cookie };
  await saveAccount(id, session);
  const destination = connected.headers.get('location');
  const cwd = destination ? new URL(destination, url).searchParams.get('cwd') : null;
  return Response.json({ ok: true, cwd });
}
