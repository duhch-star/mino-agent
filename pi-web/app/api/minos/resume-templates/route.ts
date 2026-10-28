import { NextRequest, NextResponse } from 'next/server';
import { backendFetch } from '@/lib/minos-gateway';

// Only public, fixed upstream resources. Never proxy a user-provided URL/path.
const templates = new Set(['classic', 'sidebar', 'mcdowell', 'hunner', 'minimal', 'awesome', 'fortyseconds']);
const resources = new Set(['original.pdf', 'template.pdf', 'license', 'readme']);
export async function GET(request: NextRequest) {
  const template = request.nextUrl.searchParams.get('template');
  const resource = request.nextUrl.searchParams.get('resource');
  if ((template || resource) && (!template || !resource || !templates.has(template) || !resources.has(resource))) {
    return NextResponse.json({ error: '模板资源不存在' }, { status: 404 });
  }
  try {
    const isPdf = resource === 'original.pdf' || resource === 'template.pdf';
    const response = await backendFetch(template
      ? `/api/resume/templates/${template}/${isPdf ? 'original.pdf' : resource}` : '/api/resume/templates');
    if (!response.ok) return NextResponse.json({ error: '暂时无法读取开源模板' }, { status: response.status });
    if (template) {
      return new Response(response.body, { headers: {
        'Content-Type': isPdf ? 'application/pdf' : 'text/plain; charset=utf-8',
        'Content-Disposition': isPdf ? `inline; filename="${['classic', 'sidebar', 'awesome', 'fortyseconds'].includes(template) ? 'upstream-example' : 'synthetic-template-example'}.pdf"` : 'inline',
        'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'private, max-age=3600',
      } });
    }
    const data = await response.json();
    const items = (data.items || []).filter((item: { id: string }) => templates.has(item.id)).map((item: { id: string }) => ({
      ...item,
      exampleKind: ['classic', 'sidebar', 'awesome', 'fortyseconds'].includes(item.id) ? 'upstream-original' : 'synthetic-adaptation',
      originalPdfUrl: `/api/minos/resume-templates?template=${item.id}&resource=${['classic', 'sidebar', 'awesome', 'fortyseconds'].includes(item.id) ? 'original.pdf' : 'template.pdf'}`,
      licenseUrl: `/api/minos/resume-templates?template=${item.id}&resource=license`,
      readmeUrl: `/api/minos/resume-templates?template=${item.id}&resource=readme`,
    }));
    return NextResponse.json({ items }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: '无法连接模板服务，请稍后重试' }, { status: 502 });
  }
}
