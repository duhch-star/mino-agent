/** One cancellable voice turn. Media belongs to this controller, not an iframe. */
export function createInterviewAudio({ fetchAudio, createAudio = url => new Audio(url), synthesis = globalThis.speechSynthesis, Utterance = globalThis.SpeechSynthesisUtterance, now = () => performance.now(), onState = () => {}, onError = () => {}, onMetrics = () => {}, timeoutMs = 6000 }) {
  let generation = 0, cleanup = () => {};
  function stop() { generation++; cleanup(); cleanup = () => {}; onState('idle'); }
  async function speak(text, { provider = 'auto', rate = 1, voiceURI = '' } = {}) {
    stop(); const run = generation; const started = now(); let firstSound = false;
    const live = () => run === generation;
    const startedPlaying = name => { if (!live()) return; firstSound = true; onMetrics({ provider: name, firstAudioMs: Math.round(now() - started) }); onState('playing'); };
    const browser = () => {
      if (!live()) return;
      if (!synthesis || !Utterance) { onError('当前浏览器无可用语音，请使用文字作答。'); onState('idle'); return; }
      const utterance = new Utterance(text); utterance.lang = 'zh-CN'; utterance.rate = rate;
      let available = [];
      try { available = synthesis.getVoices() || []; } catch { /* Some browsers expose voices only after activation. */ }
      const voice = available.find(v => v.voiceURI === voiceURI) || available.find(v => /^zh/i.test(v.lang) && v.localService) || available.find(v => /^zh/i.test(v.lang));
      if (voice) utterance.voice = voice;
      let watchdog = setTimeout(() => { if (live()) { synthesis.cancel(); onError('浏览器未开始播报，请点击重播或使用文字。'); onState('idle'); } }, 8000);
      const finish = () => { clearTimeout(watchdog); if (live()) onState('idle'); };
      utterance.onstart = () => { if (!live()) return; clearTimeout(watchdog); watchdog = setTimeout(() => { if (live()) { synthesis.cancel(); onError('播报超时，已停止。'); onState('idle'); } }, Math.max(20000, text.length * 900)); startedPlaying('browser'); };
      utterance.onend = finish;
      utterance.onerror = () => { if (live()) { onError('浏览器播报被阻止或中断，请手动重播。'); finish(); } };
      cleanup = () => { clearTimeout(watchdog); utterance.onstart = utterance.onend = utterance.onerror = null; synthesis.cancel(); };
      try { synthesis.speak(utterance); }
      catch { clearTimeout(watchdog); utterance.onstart = utterance.onend = utterance.onerror = null; onError('浏览器无法启动播报，请重播或使用文字。'); if (live()) onState('idle'); }
    };
    onState('generating'); onMetrics({ provider, firstAudioMs: null });
    if (provider === 'browser') { browser(); return; }
    const controller = new AbortController(); let timer;
    cleanup = () => { clearTimeout(timer); controller.abort(); };
    try {
      const timeout = new Promise((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new Error('语音生成超时')); }, timeoutMs); });
      const blob = await Promise.race([fetchAudio(text, controller.signal), timeout]);
      clearTimeout(timer); if (!live()) return;
      const url = URL.createObjectURL(blob); const audio = createAudio(url); audio.playbackRate = rate;
      let mediaTimer;
      const dispose = () => { clearTimeout(mediaTimer); audio.onplaying = audio.onended = audio.onerror = null; audio.pause(); audio.removeAttribute?.('src'); audio.load?.(); URL.revokeObjectURL(url); };
      cleanup = () => { controller.abort(); dispose(); };
      let failed = false;
      const fail = () => { if (!live() || failed) return; failed = true; dispose(); if (provider === 'auto' && !firstSound) { onError('云端播报未就绪，已切换浏览器语音。'); browser(); } else { onError('音频播放失败，请手动重播或使用文字。'); onState('idle'); } };
      audio.onplaying = () => { clearTimeout(mediaTimer); startedPlaying('mambo'); mediaTimer = setTimeout(fail, Math.max(20000, text.length * 900)); };
      audio.onended = () => { if (live()) { dispose(); cleanup = () => {}; onState('idle'); } };
      audio.onerror = fail;
      mediaTimer = setTimeout(fail, 8000);
      try { await audio.play(); } catch { fail(); }
    } catch {
      clearTimeout(timer); if (!live()) return;
      if (provider === 'auto') { onError('云端语音不可用，已切换浏览器语音。'); browser(); }
      else { onError('云端语音未就绪，请改用浏览器语音或文字。'); onState('idle'); }
    }
  }
  return { speak, stop };
}
