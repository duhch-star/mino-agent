/** Incremental NDJSON decoder; a preview is not a validated final report. */
export async function readFeedbackStream(response, { onPreview = () => {}, signal } = {}) {
  if (!response.body) throw new Error('反馈流不可用，回答已保留');
  const reader = response.body.getReader(), decoder = new TextDecoder();
  let buffer = '', result, complete = false, bytes = 0, previewed = false;
  const text = (value, max) => typeof value === 'string' && value.trim().length > 0 && value.length <= max;
  const score = value => Number.isInteger(value) && value >= 1 && value <= 5;
  const list = value => Array.isArray(value) && value.length >= 1 && value.length <= 6 && value.every(item => text(item,800));
  const consume = line => {
    if (!line.trim()) return;
    const event = JSON.parse(line);
    if (event.type === 'error') throw new Error(event.message || '详细反馈失败，请重试');
    if (complete) throw new Error('反馈流重复结束');
    if (event.type === 'preview') {
      if (previewed || !text(event.reply,1000) || !Number.isFinite(event.elapsedMs) || event.elapsedMs < 0) throw new Error('反馈预览无效');
      previewed = true;
      onPreview({ reply: event.reply, elapsedMs: event.elapsedMs });
    } else if (event.type === 'complete') {
      result = event.feedback;
      if (!result || !score(result.score) || !Array.isArray(result.dimensions) || result.dimensions.length !== 3 || !result.dimensions.every(dim => dim && text(dim.name,80) && score(dim.stars) && text(dim.note,500)) || !list(result.strengths) || !list(result.suggestions) || !text(result.reply,1000) || !text(result.starExample,4000) || result.chapterId !== 'star') throw new Error('反馈数据无效');
      complete = true;
    } else throw new Error('未知反馈事件');
  };
  const abort = () => reader.cancel().catch(() => {});
  signal?.addEventListener('abort', abort, { once:true });
  try {
    while (true) {
      if (signal?.aborted) throw new DOMException('Aborted','AbortError');
      const {value,done} = await reader.read();
      if (done) { buffer += decoder.decode(); if (buffer.trim()) consume(buffer); break; }
      bytes += value.byteLength;
      if (bytes > 128000) throw new Error('反馈流过长');
      buffer += decoder.decode(value,{stream:true});
      let end;
      while ((end=buffer.indexOf('\n')) >= 0) { consume(buffer.slice(0,end)); buffer=buffer.slice(end+1); }
    }
    if (signal?.aborted) throw new DOMException('Aborted','AbortError');
    if (!complete) throw new Error('反馈流中断，回答已保留，请重试');
    return result;
  } finally { signal?.removeEventListener('abort',abort); await reader.cancel().catch(()=>{}); reader.releaseLock(); }
}
