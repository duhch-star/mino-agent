import { NextRequest, NextResponse } from 'next/server';
import { backendFetch } from '@/lib/minos-gateway';

// Only public, fixed upstream resources. Never proxy a user-provided URL/path.
const templates = new Set(['classic', 'sidebar']);
const resources = new Set(['original.pdf', 'license', 'readme']);
export async function GET(request: NextRequest) {
  const template = request.nextUrl.searchParams.get('template');
  const resource = request.nextUrl.searchParams.get('resource');
  if ((template || resource) && (!template || !resource || !templates.has(template) || !resources.has(resource))) {
    return NextResponse.json({ error: '模板资源不存在' }, { status: 404 });
  }
  try {
    const response = await backendFetch(template
      ? `/api/resume/templates/${template}/${resource}` : '/api/resume/templates');
    if (!response.ok) return NextResponse.json({ error: '暂时无法读取开源模板' }, { status: response.status });
    if (template) {
      return new Response(response.body, { headers: {
        'Content-Type': resource === 'original.pdf' ? 'application/pdf' : 'text/plain; charset=utf-8',
        'Content-Disposition': resource === 'original.pdf' ? 'inline; filename="upstream-example.pdf"' : 'inline',
        'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'private, max-age=3600',
      } });
    }
    const data = await response.json();
    const items = (data.items || []).filter((item: { id: string }) => templates.has(item.id)).map((item: { id: string }) => ({
      ...item,
      originalPdfUrl: `/api/minos/resume-templates?template=${item.id}&resource=original.pdf`,
      licenseUrl: `/api/minos/resume-templates?template=${item.id}&resource=license`,
      readmeUrl: `/api/minos/resume-templates?template=${item.id}&resource=readme`,
    }));
    return NextResponse.json({ items }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: '无法连接模板服务，请稍后重试' }, { status: 502 });
  }
}
