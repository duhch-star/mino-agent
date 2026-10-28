import { loadInterviewModels, selectInterviewModel } from '@/lib/interview-model';
import { parseFeedbackInput, feedbackPrompt, validateFeedback, previewFeedback } from '@/lib/interview-feedback';
export const dynamic = 'force-dynamic';
export async function POST(req: Request) {
  let input;
  try {
    if (Number(req.headers.get('content-length')) > 64000) throw new Error('oversized');
    const raw = await req.text();
    if (raw.length > 64000) throw new Error('oversized');
    input = parseFeedbackInput(JSON.parse(raw));
  } catch { return Response.json({ error: '面试反馈请求无效。' }, { status: 400 }); }
  let resolved;
  try {
    const { runtime, scope, initial } = await loadInterviewModels(input.cwd);
    resolved = { runtime, model: selectInterviewModel(scope, initial, input.model) };
  } catch {
    return Response.json({ error: '所选 Pi 模型不可用于面试，请在面试设置中明确选择可用兼容模型。' }, { status: 409 });
  }
  const { runtime, model } = resolved;
  const controller = new AbortController();
  const abort = () => controller.abort();
  req.signal.addEventListener('abort', abort, { once: true });
  const started = Date.now();
  const encoder = new TextEncoder();
  let cancelled = false;
  const stream = new ReadableStream({
    async start(output) {
      const timer = setTimeout(abort, 25000);
      let raw = '', previewed = false;
      const send = (event: unknown) => { if (!cancelled) output.enqueue(encoder.encode(JSON.stringify(event) + '\n')); };
      try {
        const events = runtime.streamSimple(model, feedbackPrompt(input), { signal: controller.signal, maxTokens: 2400, temperature: 0.3 });
        for await (const event of events) {
          if (controller.signal.aborted) throw new Error('aborted');
          if (event.type === 'error') throw new Error('upstream');
          if (event.type === 'text_delta') {
            raw += event.delta;
            if (raw.length > 24000) throw new Error('oversized');
            const reply = previewed ? null : previewFeedback(raw);
            if (reply) { previewed = true; send({ type: 'preview', reply, elapsedMs: Date.now() - started }); }
          }
          if (event.type === 'done' && event.reason === 'length') throw new Error('truncated');
        }
        const feedback = validateFeedback(JSON.parse(raw));
        send({ type: 'complete', feedback, elapsedMs: Date.now() - started });
      } catch {
        // Never expose provider error bodies, request headers, URLs or credentials.
        if (!req.signal.aborted) send({ type: 'error', code: controller.signal.aborted ? 'feedback_timeout' : 'feedback_upstream', message: 'Pi 模型反馈失败或格式不兼容，回答已保留，请重试或另选模型。', previewOnly: previewed });
      } finally {
        clearTimeout(timer);
        req.signal.removeEventListener('abort', abort);
        if (!cancelled) output.close();
      }
    },
    cancel() { cancelled = true; abort(); },
  });
  return new Response(stream, { headers: { 'Content-Type': 'application/x-ndjson', 'Cache-Control': 'no-store', 'X-Accel-Buffering': 'no' } });
}
