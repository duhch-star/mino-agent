import { NextRequest } from 'next/server';
import { accountRequest, cookieSessionId, gatewayEnabled } from '@/lib/minos-gateway';
const roots = new Set(['users', 'usage', 'knowledge', 'guides', 'interview', 'review', 'resume', 'chat', 'career', 'files', 'speech']);
async function forward(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  if (!gatewayEnabled()) return new Response('Not available', { status: 404 });
  const id = cookieSessionId(request.headers.get('cookie'));
  if (!id) return new Response('Authentication required', { status: 401 });
  const { path } = await context.params;
  if (!roots.has(path[0]) || path.some(p => !p || p === '.' || p === '..' || /[\\/\u0000]/.test(p))) return new Response('Not found', { status: 404 });
  const headers = new Headers();
  for (const key of ['content-type', 'accept', 'range', 'if-none-match']) { const value = request.headers.get(key); if (value) headers.set(key, value); }
  const response = await accountRequest(id, `/api/${path.map(encodeURIComponent).join('/')}${request.nextUrl.search}`, {
    method: request.method, headers,
    body: ['GET', 'HEAD'].includes(request.method) ? undefined : await request.arrayBuffer(),
    signal: request.signal,
  });
  const output = new Headers({ 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  for (const key of ['content-type', 'content-disposition', 'content-range', 'etag', 'x-resume-warnings', 'x-speech-voice', 'x-speech-cache', 'x-speech-duration-ms', 'x-feedback-duration-ms', 'server-timing']) { const value = response.headers.get(key); if (value) output.set(key, value); }
  return new Response(response.body, { status: response.status, headers: output });
}
export { forward as GET, forward as POST, forward as PUT, forward as PATCH, forward as DELETE, forward as HEAD };
