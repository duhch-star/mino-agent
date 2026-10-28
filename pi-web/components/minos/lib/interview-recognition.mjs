/** Keep short recognition restarts within one answer; submit only stable final text. */
export function createInterviewRecognition({ Recognition, onText, onInterim, onListening, onAnswer, onError, silenceMs = 1800, autoSubmit = false, initialText = '' }) {
  let disposed = false, finalText = initialText ? initialText.trim() + ' ' : '', partial = '', idleTimer, restartTimer, recognition;
  let failed = false, submitted = false;
  function publish() { onText((finalText + partial).trim()); onInterim(partial); }
  function finish() {
    if (disposed || submitted || failed) return;
    if (partial.trim()) { onError('仍有未确认的转写，请继续说话或手动提交。'); return; }
    if (!finalText.trim()) return;
    submitted = true; clearTimeout(restartTimer); recognition?.abort(); onListening(false); onAnswer(finalText.trim());
  }
  const hasNewFinal = () => finalText.trim().length > initialText.trim().length;
  function schedule() { clearTimeout(idleTimer); if (autoSubmit && hasNewFinal() && !partial.trim()) idleTimer = setTimeout(finish, silenceMs); }
  function start() {
    if (disposed || submitted || failed) return;
    let engine;
    try { engine = new Recognition(); } catch { failed = true; onListening(false); onError('无法创建语音识别，请使用文字或重试。'); return; }
    recognition = engine; recognition.lang = 'zh-CN'; recognition.continuous = true; recognition.interimResults = true;
    const live = () => !disposed && !submitted && !failed && recognition === engine;
    let cycleFinal = '';
    recognition.onstart = () => { if (live()) onListening(true); };
    recognition.onresult = event => {
      if (!live()) return;
      let complete = '', interim = '';
      for (let i = 0; i < event.results.length; i++) { if (event.results[i].isFinal) complete += event.results[i][0].transcript; else interim += event.results[i][0].transcript; }
      // Each engine cycle reports its whole result list, not just the delta.
      const prior = finalText.slice(0, finalText.length - cycleFinal.length);
      cycleFinal = complete; finalText = prior + complete; partial = interim;
      publish(); schedule();
    };
    recognition.onerror = event => {
      if (!live()) return;
      if (event.error === 'aborted') return;
      failed = true; clearTimeout(idleTimer);
      const messages = { 'not-allowed':'麦克风或语音识别权限未获授权。', 'audio-capture':'未找到可用麦克风。', network:'语音识别服务连接失败，转写已保留，请手动提交。', 'no-speech':'暂未识别到语音，点击重试收音。' };
      onError(messages[event.error] || '语音识别中断，请重试或手动提交。'); onListening(false);
    };
    recognition.onend = () => {
      if (!live()) return;
      recognition = null;
      onListening(false);
      // Preserve interim text visibly, but never auto-submit unconfirmed words.
      if (partial) { onError('识别已暂停，未确认转写已保留，可手动更正提交。'); return; }
      if (autoSubmit && hasNewFinal()) { schedule(); return; }
      restartTimer = setTimeout(start, 250);
    };
    try { recognition.start(); } catch { failed = true; onListening(false); onError('无法启动语音识别，请重试。'); }
  }
  start();
  return { stop() { disposed = true; clearTimeout(idleTimer); clearTimeout(restartTimer); recognition?.abort(); onListening(false); }, finish };
}
