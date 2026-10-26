import { NextRequest, NextResponse } from 'next/server';
import { connectAccount, cookieSessionId, gatewayEnabled, loadAccount } from '@/lib/minos-gateway';
export async function POST(request: NextRequest) {
  if (!gatewayEnabled()) return NextResponse.json({ error: 'Not available' }, { status: 404 });
  const id = cookieSessionId(request.headers.get('cookie'));
  if (!id || !await loadAccount(id)) return NextResponse.json({ error: '请先登录' }, { status: 401 });
  try {
    const body = await request.json();
    return await connectAccount(id, body.acknowledgeLocalAgent === true);
  } catch { return NextResponse.json({ error: { message: 'Pi 工作区连接失败，请检查后端和生产构建' } }, { status: 502 }); }
}
