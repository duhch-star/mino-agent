import { NextRequest, NextResponse } from 'next/server';
import { connectAccount, cookieSessionId, gatewayEnabled, loadAccount } from '@/lib/minos-gateway';
export async function POST(request: NextRequest) {
  if (!gatewayEnabled()) return NextResponse.json({ error: 'Not available' }, { status: 404 });
  const id = cookieSessionId(request.headers.get('cookie'));
  if (!id || !await loadAccount(id)) return NextResponse.json({ error: '请先登录' }, { status: 401 });
  try {
    const body = await request.json();
    return await connectAccount(id, body.acknowledgeLocalAgent === true);
  } catch (error) {
    const name = error instanceof Error ? error.name : '';
    const timedOut = name === 'TimeoutError' || name === 'AbortError';
    // Never log backend response bodies, ticket URLs, cookies or provider secrets.
    console.error('[MINOS connect]', timedOut ? 'startup-timeout' : 'connection-unavailable');
    return NextResponse.json({ error: { message: timedOut
      ? '工作区首次启动较慢，请稍候再试。你仍可继续浏览其他页面。'
      : '工作区连接中断，请重试；若仍失败，请从顶栏菜单打开日志目录查看服务状态。' } }, { status: timedOut ? 504 : 502 });
  }
}
