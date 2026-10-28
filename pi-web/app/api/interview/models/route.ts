import { loadInterviewModels } from '@/lib/interview-model';
export const dynamic = 'force-dynamic';
// Routed to the authenticated user's Pi sidecar by proxy.ts. Deliberately
// expose only model identity/capability, never URLs, headers or credentials.
export async function GET(req: Request) {
  try {
    const cwd = new URL(req.url).searchParams.get('cwd') || undefined;
    const { models, initial } = await loadInterviewModels(cwd);
    return Response.json({ models, defaultModel: initial.model ? { provider: initial.model.provider, modelId: initial.model.id } : null, scope: cwd ? 'pi-project' : 'pi-global' }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return Response.json({ error: '读取 Pi 模型失败，请检查对话中的模型设置。' }, { status: 503 });
  }
}
