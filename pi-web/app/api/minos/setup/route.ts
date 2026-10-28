import { NextRequest, NextResponse } from 'next/server';
import { backendFetch, gatewayEnabled } from '@/lib/minos-gateway';

export async function GET() {
  if (!gatewayEnabled() || process.env.MINOS_DESKTOP !== '1') return NextResponse.json({ setupRequired: false });
  try {
    const response = await backendFetch('/api/auth/desktop-status');
    if (!response.ok) return NextResponse.json({ setupRequired: false });
    return NextResponse.json(await response.json(), { headers: { 'Cache-Control': 'no-store' } });
  } catch { return NextResponse.json({ error: '本机服务未就绪' }, { status: 503 }); }
}
export async function POST(request: NextRequest) {
  if (!gatewayEnabled() || process.env.MINOS_DESKTOP !== '1') return NextResponse.json({ error: 'Not available' }, { status: 404 });
  const origin = request.headers.get('origin');
  if (!origin || origin !== `${request.nextUrl.protocol}//${request.headers.get('host')}`) return NextResponse.json({ error: 'Invalid origin' }, { status: 403 });
  try {
    const body = await request.json();
    const response = await backendFetch('/api/auth/desktop-setup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: body.username, password: body.password }) });
    const data = await response.json();
    return NextResponse.json(response.ok ? { ok: true } : { error: data.error?.message || data.message || data.detail || '创建失败，请检查账号和密码' }, { status: response.status });
  } catch { return NextResponse.json({ error: '无法连接本机服务' }, { status: 502 }); }
}
