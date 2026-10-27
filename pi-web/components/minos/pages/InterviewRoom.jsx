import { useEffect, useRef, useState } from 'react'
import '../styles/interview-live.css'
import { CareerGeneratedUI } from '../../CareerGeneratedUI'
import CharacterView from '../components/CharacterView.jsx'
import { useInterviewSpeech } from '../lib/useInterviewSpeech.js'
import { useInterviewRecognition } from '../lib/useInterviewRecognition.js'
import { downloadInterviewReport } from '../lib/interview-report.mjs'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { fetchInterviewFeedback, finishInterviewSession, submitInterviewAnswer } from '../api.js'
import { useInterviewStore } from '../store.js'
import { ensureChapterIndex, getChapterTitle } from '../lib/chapterIndex.js'

import { IconMic, IconSend, IconStop, IconPause, IconArrowLeft, IconRefresh, IconCheck, IconBook, IconVideo } from '../components/Icons.jsx'

// 轻量 2D 小北头像：替代旧火箭及 GLB 加载链路。

function Stars({ n }) {
  return <span className="stars">{'★'.repeat(Math.max(0, n))}{'☆'.repeat(Math.max(0, 5 - n))}</span>
}

// 面试状态 → 角色动画
function characterFor(phase, stage, micOn, typing) {
  if (phase === 'report') return 'encourage'
  if (phase === 'running') {
    if (stage === 'feedbacking') return 'think'
    if (stage === 'feedback') return 'encourage'
    return 'listen'
  }
  return 'idle'
}

function Waveform() {
  return (
    <span className="waveform" aria-hidden="true">
      {Array.from({ length: 12 }).map((_, i) => <span key={i} className={`bar b${i % 5}`} />)}
    </span>
  )
}

export default function InterviewRoom() {
  const navigate = useNavigate()
  const location = useLocation()
  const prefix = location.pathname.startsWith('/embedded/') ? '/embedded' : ''
  const localPath = path => `${prefix}${path}`
  const st = useInterviewStore()
  const [exportStatus, setExportStatus] = useState('')
  const [feedbackMs, setFeedbackMs] = useState(null)
  const [feedbackPreview, setFeedbackPreview] = useState(null)
  const feedbackAbort = useRef(null)
  useEffect(() => () => feedbackAbort.current?.abort(), [])
  const [waitingSeconds, setWaitingSeconds] = useState(0)
  useEffect(() => {
    if (st.stage !== 'feedbacking') return
    const started = performance.now(); setWaitingSeconds(0)
    const timer = setInterval(() => setWaitingSeconds(Math.floor((performance.now() - started) / 1000)), 1000)
    return () => clearInterval(timer)
  }, [st.stage])

  // 本页只消费真实会话接口，旧 store 的演示题库/模板追问不参与此流程。
  const submitAnswer = async answer => {
    const current = useInterviewStore.getState()
    const clean = (answer || '').trim()
    if (!clean || current.phase !== 'running' || current.stage !== 'asking' || current.paused || current.finishing) return false
    if (clean.length > 4000) {
      useInterviewStore.setState({ answerError: '回答最多 4000 字，请缩短后提交' })
      return false
    }
    const { sessionId, index, position, questions, messages } = current
    if (!sessionId) { useInterviewStore.setState({ answerError: '面试会话已失效，请返回重新创建' }); return false }
    const q = questions[index]
    const history = messages.at(-1)?.role === 'user' ? messages.slice(0, -1) : messages
    setFeedbackPreview(null)
    feedbackAbort.current?.abort()
    const controller = new AbortController(); feedbackAbort.current = controller
    const answerSubmittedAt = performance.now()
    const deadline = setTimeout(() => controller.abort(), 30000)
    useInterviewStore.setState({ stage: 'feedbacking', answerError: '', micOn: false, messages: [...history, { role: 'user', text: clean, time: Date.now() }] })
    const isCurrent = () => feedbackAbort.current === controller && !controller.signal.aborted && useInterviewStore.getState().sessionId === sessionId && useInterviewStore.getState().phase === 'running'
    try {
      let pending = current.pendingAnswer
      if (!pending || pending.index !== index || pending.answer !== clean) {
        await submitInterviewAnswer(sessionId, { questionId: current.questionIds[index], question: q, answer: clean, answerMode: current.mode })
        pending = { index, answer: clean }
        if (!isCurrent()) return false
        useInterviewStore.setState({ pendingAnswer: pending })
      }
      // answers 端点的启发式分数不能冒充大模型反馈。
      const feedbackStarted = performance.now()
      const feedback = await fetchInterviewFeedback(position, q, clean, history, { signal: controller.signal, onPreview: preview => { if (isCurrent()) setFeedbackPreview({ ...preview, elapsedMs: Math.round(performance.now() - answerSubmittedAt), serverElapsedMs: preview.elapsedMs }) } })
      if (!isCurrent()) return false
      setFeedbackMs(Math.round(performance.now() - feedbackStarted))
      useInterviewStore.setState(s => ({
        transcript: [...s.transcript, { q, a: clean, feedback }], stage: 'feedback', pendingAnswer: null,
        messages: [...s.messages, { role: 'assistant', text: feedback.reply, time: Date.now() }],
      }))
      return true
    } catch (error) {
      if (feedbackAbort.current === controller && useInterviewStore.getState().sessionId === sessionId && useInterviewStore.getState().phase === 'running') useInterviewStore.setState({ stage: 'asking', answerError: controller.signal.aborted ? '反馈已超时或中断，回答已保留，请重试' : error.message || '提交失败，请重试；回答已保留' })
      return false
    } finally { clearTimeout(deadline) }
  }

  const cancelFeedback = () => {
    const current = useInterviewStore.getState()
    if (current.stage !== 'feedbacking') return
    const controller = feedbackAbort.current
    feedbackAbort.current = null // Invalidate before abort so late handlers cannot mutate the turn.
    controller?.abort()
    useInterviewStore.setState({ stage: 'asking', micOn: false, answerError: '已取消反馈生成，回答与已有预览已保留；可重试或结束面试，预览不计入评分。' })
  }

  const finish = async () => {
    const current = useInterviewStore.getState()
    if (current.finishing || current.stage === 'feedbacking' || current.finished) return
    if (!current.sessionId) return
    const sessionId = current.sessionId
    useInterviewStore.setState({ finishing: true, finishError: '', paused: true, micOn: false })
    try {
      const result = await finishInterviewSession(sessionId)
      if (useInterviewStore.getState().sessionId !== sessionId) return
      useInterviewStore.setState({ phase: 'report', stage: 'asking', finished: true, serverReport: result.report, followup: null })
    } catch (error) {
      if (useInterviewStore.getState().sessionId === sessionId) useInterviewStore.setState({ finishError: error.message || '结束面试失败，请重试；当前记录已保留' })
    } finally {
      if (useInterviewStore.getState().sessionId === sessionId) useInterviewStore.setState({ finishing: false })
    }
  }

  const nextQuestion = () => {
    const current = useInterviewStore.getState()
    if (current.stage !== 'feedback' || current.paused || current.finishing) return
    if (current.index + 1 >= current.questions.length) { finish(); return }
    useInterviewStore.setState(s => ({ index: s.index + 1, stage: 'asking', followup: null, micOn: false, answerError: '',
      messages: [...s.messages, { role: 'assistant', text: s.questions[s.index + 1], time: Date.now() }] }))
  }

  const exit = () => {
    const current = useInterviewStore.getState()
    if (current.phase === 'report' || !current.sessionId) navigate(localPath('/interview'))
    else finish()
  }
  const [draft, setDraft] = useState('')
  const [micStatus, setMicStatus] = useState('')

  const [voiceAuto, setVoiceAuto] = useState(true)
  const [autoSubmit, setAutoSubmit] = useState(false)
  const [editing, setEditing] = useState(false)

  const testMic = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.getTracks().forEach(track => track.stop())
      setMicStatus('ok')
    } catch {
      setMicStatus('fail')
    }
  }

  // 章节索引（复盘"去补课"标题）
  useEffect(() => {
    ensureChapterIndex().catch(() => {})
  }, [])

  // 视频面试：摄像头 + 自拍视图
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const [cameraOn, setCameraOn] = useState(false)
  const [cameraStatus, setCameraStatus] = useState('')

  useEffect(() => {
    return () => { streamRef.current?.getTracks().forEach(t => t.stop()) }
  }, [])

  useEffect(() => {
    if (st.phase === 'report' || st.paused) { streamRef.current?.getTracks().forEach(t => t.stop()); streamRef.current = null; setCameraOn(false) }
  }, [st.phase, st.paused])

  useEffect(() => {
    if (cameraOn && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current
    }
  }, [cameraOn])

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
      streamRef.current?.getTracks().forEach(t => t.stop())
      streamRef.current = stream
      setCameraOn(true)
      setCameraStatus('ok')
      return true
    } catch {
      setCameraStatus('fail')
      setCameraOn(false)
      return false
    }
  }

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    setCameraOn(false)
  }

  const beginVideo = async () => {
    const ok = await startCamera()
    if (ok) st.start()
  }

  // 未配置直接进房间 → 回到配置页
  useEffect(() => {
    if (!st.sessionId || (st.phase === 'config' && st.questions.length === 0)) navigate(`${prefix}/interview`)
  }, [st.phase, st.questions.length, st.sessionId, navigate, prefix])

  const total = st.questions.length
  const question = st.followup || st.questions[st.index] || ''
  const last = st.transcript[st.transcript.length - 1]
  const typing = draft.trim().length > 0

  // Keep one stable feedback turn across preview -> validated report to avoid replay.
  const speechStage = st.stage === 'feedbacking' && feedbackPreview ? 'feedback' : st.stage
  const spokenText = speechStage === 'feedback' ? (feedbackPreview?.reply || last?.feedback?.reply || '') : question
  const speech = useInterviewSpeech({ phase: st.phase, stage: speechStage, question: spokenText, index: st.index,
    paused: st.paused, mode: st.mode, typing: st.stage === 'asking' && editing })
  const recognition = useInterviewRecognition({
    active: voiceAuto && !editing && st.mode !== 'text' && st.phase === 'running' && st.stage === 'asking' && !st.paused && speech.readyForAnswer && !st.answerError,
    autoSubmit, initialText: draft,
    onText: setDraft,
    onListening: st.setMic,
    onAnswer: async text => { const ok = await submitAnswer(text); if (ok) setDraft('') },
  })
  useEffect(() => { setDraft(''); setEditing(false); setFeedbackPreview(null); setFeedbackMs(null) }, [st.index, st.followup])
  const character = st.paused ? 'idle' : speech.status === 'generating' ? 'think'
    : speech.status === 'playing' ? 'talk' : characterFor(st.phase, st.stage, st.micOn, typing)

  const submit = async () => {
    if (!draft.trim()) return
    setVoiceAuto(false)
    const ok = await submitAnswer(draft)
    if (ok) { setDraft(''); setEditing(false); setVoiceAuto(true) }
  }

  // —— 复盘报告 ——
  if (st.phase === 'report') {
    const avg = st.transcript.length
      ? Math.round((st.transcript.reduce((s, t) => s + t.feedback.score, 0) / st.transcript.length) * 10) / 10
      : 0
    return (
      <div className="interviewRoom">
        <header className="interviewTop">
          <button className="iconButton" onClick={exit} aria-label="退出"><IconArrowLeft size={16} /></button>
          <div className="interviewTopTitle">{st.position} · 面试复盘</div>
          <div className="interviewTopMeta">{st.transcript.length} 题 · 平均 {avg} 分</div>
        </header>

        <div className="reportView">
          <div className="reportHead">
            <h1>面试复盘</h1>
            <p className="pageSub">MINO AGENT 基于你的回答给出的训练建议（仅供参考，不构成录用判断）</p>
            <p className="formHint">面试回答已保存至服务端；下方为本次真实大模型逐题反馈。</p>
          </div>

          <div className="interviewReportOverview"><div><span>已完成练习</span><strong>{st.transcript.length}<small> 题</small></strong></div><div><span>本次参考均分</span><strong>{avg}<small> / 5</small></strong></div><div><span>反馈来源</span><strong className="interviewReportSource">逐题模型分析</strong></div></div>
          {st.transcript.length === 0 && <p className="formHint">本次尚无完成评分的回答，可重新开始练习。未完成反馈不会算作零分。</p>}
          {st.transcript.map((t, i) => (
            <div key={i} className="reportItem">
              <div className="reportQ"><span className="reportIdx">Q{i + 1}</span>{t.q}</div>
              <div className="reportA">{t.a}</div>
              <div className="reportFb">
                <CareerGeneratedUI data={{version:1,type:'interview-feedback',title:`第 ${i + 1} 题 · 表达能力复盘`,summary:t.feedback.reply,items:t.feedback.dimensions.map((d,j)=>({id:`dimension-${j}`,title:d.name,description:d.note,score:d.stars,maxScore:5,evidence:`你的回答：${t.a}`,status:d.stars>=4?'strength':'gap'}))}} />
                <div className="reportScore">综合 {t.feedback.score}/5</div>
                {t.feedback.strengths.map((s, j) => <div key={j} className="fbLine good"><IconCheck size={14} />{s}</div>)}
                {t.feedback.suggestions.map((s, j) => <div key={j} className="fbLine hint">· {s}</div>)}
                <div className="starExample">
                  <div className="starExampleTitle">STAR 改写示例</div>
                  <pre>{t.feedback.starExample}</pre>
                </div>
                <Link to={localPath(`/guide/${t.feedback.chapterId}`)} className="btn outline sm goStudy">
                  <IconBook size={14} />去补课：{getChapterTitle(t.feedback.chapterId)}
                </Link>
              </div>
            </div>
          ))}

          <section className="interviewChat" aria-label="完整面试聊天记录">
            <div className="questionLabel">本次完整对话记录</div>
            {(st.messages || []).map((message, i) => <div key={i} className={`interviewMessage ${message.role}`}><strong>{message.role === 'user' ? '你' : '小北 · 面试官'}</strong><p>{message.text}</p></div>)}
          </section>
          <p className="formHint">导出包含本次问答与练习反馈，请妥善保管个人经历；仅在点击后生成本地文件。</p>
          {exportStatus && <p className="formHint" role="status">{exportStatus}</p>}
          <div className="reportActions">
            <button className="btn outline" onClick={() => { try { downloadInterviewReport(st); setExportStatus('已请求下载复盘 Markdown') } catch { setExportStatus('导出失败，请手动复制本页内容') } }}>导出复盘 Markdown</button>
            <button className="btn primary" onClick={() => { st.reset(); navigate(localPath('/interview')) }}>再来一次</button>
            <button className="btn ghost" onClick={() => navigate(localPath('/knowledge'))}>去知识库补课</button>
          </div>
        </div>
      </div>
    )
  }

  // —— 准备 / 进行中 ——
  return (
    <div className="interviewRoom">
      <header className="interviewTop">
        <button className="iconButton" onClick={exit} aria-label="退出"><IconArrowLeft size={16} /></button>
        <div className="interviewTopTitle">{st.position} · {st.difficulty}</div>
        <div className="interviewTopMeta">
          {st.phase === 'running' ? `第 ${st.index + 1}/${total} 题 · ${st.duration}` : st.duration}
        </div>
        {st.phase === 'running' && (
          <>
            <button className="btn ghost sm" onClick={st.togglePause}>{st.paused ? '继续' : '暂停'}</button>
            <button className="btn ghost sm" disabled={st.finishing || st.stage === 'feedbacking'} onClick={finish}>结束面试</button>
          </>
        )}
      </header>

      {st.finishError && <p className="formHint" role="alert">结束失败：{st.finishError} <button className="btn ghost sm" disabled={st.finishing} onClick={finish}>重试结束</button></p>}
      {st.finishing && <p className="formHint" role="status">正在保存并结束面试…</p>}
      <div className="interviewBody">
        <div className="interviewCharacter">
          <CharacterView state={character} />
          {st.mode === 'video' && cameraOn && (
            <video ref={videoRef} className="selfView" autoPlay muted playsInline />
          )}
        </div>

        <div className="interviewFlow">
          {st.phase === 'prepare' && (
            <div className="prepareView">
              <h1>准备开始</h1>
              <p className="pageSub">
                {st.mode === 'video'
                  ? '视频面试需要摄像头与麦克风权限，用于面对面交流，仅在你授权后开启。'
                  : st.mode === 'voice'
                    ? '请确认麦克风可用。录音仅在你明确授权后开启，可随时暂停、结束或删除。'
                    : `共 ${total} 道题，MINO AGENT 会逐题提问并给出反馈。`}
              </p>
              {st.mode !== 'text' && <p className="formHint">可选择本机/浏览器声音或曼波云端播报。云端模式会发送题目与反馈文字到语音供应商；浏览器声音标注“在线”时也可能使用网络服务。语音识别可能由浏览器供应商在线处理，转写后提交面试模型。仅在播报停止后收音，默认先核对再提交；可随时关闭播报或改用文字。建议佩戴耳机。</p>}
              <ul className="md-ul">
                <li>岗位：{st.position} · {st.difficulty}</li>
                <li>时长：约 {st.duration}</li>
                <li>作答方式：{st.mode === 'video' ? '视频（面对面）' : st.mode === 'voice' ? '语音（可用文字更正）' : '文字'}</li>
              </ul>
              {st.mode === 'voice' && (
                <div className="uploadRow" style={{ marginBottom: 12 }}>
                  <button className="btn outline sm" onClick={testMic}>测试麦克风</button>
                  {micStatus === 'ok' && <span className="fbLine good"><IconCheck size={14} />麦克风可用</span>}
                  {micStatus === 'fail' && <span className="fbLine hint">· 麦克风不可用，可切换文字作答</span>}
                </div>
              )}
              {st.mode === 'video' ? (
                <div className="cameraPrompt">
                  <button className="btn primary big" onClick={beginVideo}>开启摄像头并开始</button>
                  <button className="btn ghost" onClick={() => st.setMode('text')}>改用文字</button>
                  <button className="btn ghost" onClick={() => st.setMode('voice')}>改用语音</button>
                  {cameraStatus === 'fail' && <span className="fbLine hint">· 无法访问摄像头，请改用文字/语音</span>}
                </div>
              ) : (
                <button className="btn primary big" onClick={st.start}>开始面试</button>
              )}
            </div>
          )}

          {st.phase === 'running' && (
            <>
              {st.paused && <div className="pausedBanner">已暂停 · 点击右上角「继续」恢复</div>}
              {/* 面试官提问 */}
              <div className="questionCard">
                <div className="questionLabel">面试官提问</div>
                <p className="questionText">{question}</p>
                {st.mode !== 'text' && <div className="interviewSpeechControls">
                  <button className="btn ghost sm" onClick={() => speech.setEnabled(v => !v)}>{speech.enabled ? '关闭语音播报' : '开启语音播报'}</button>
                  <button className="btn ghost sm" disabled={!speech.enabled || st.paused || !['asking','feedback'].includes(st.stage)} onClick={speech.replay}>重播当前内容</button>
                  <button className="btn outline sm" disabled={speech.status === 'idle'} onClick={speech.stop}>停止播报 · 我要回答</button>
                  <span className="interviewLiveStatus" role="status"><i data-state={speech.status} />{speech.status === 'generating' ? '正在准备声音' : speech.status === 'playing' ? '面试官正在播报' : st.micOn ? '正在收音' : '语音就绪'}</span>
                  <label>声音来源<select aria-label="声音来源" value={speech.provider} onChange={e => speech.setProvider(e.target.value)}><option value="auto">自动 · 根据可用服务选择</option><option value="browser">浏览器语音 · 快速响应</option><option value="mambo">曼波云端语音</option></select></label>
                  <label>语速<select aria-label="播报语速" value={speech.rate} onChange={e => speech.setRate(Number(e.target.value))}><option value={0.85}>0.85×</option><option value={1}>1×</option><option value={1.15}>1.15×</option><option value={1.3}>1.3×</option></select></label>
                  {speech.provider === 'auto' && <span className="formHint">{speech.configuration?.configured ? '云端已配置 · 网络失败自动使用浏览器声音' : '云端未配置或状态未知 · 自动直接使用浏览器声音'}</span>}
                  {(speech.provider === 'browser' || (speech.provider === 'auto' && !speech.configuration?.configured)) && speech.voices.length > 0 && <label>音色<select aria-label="浏览器音色" value={speech.voiceURI} onChange={e => speech.setVoiceURI(e.target.value)}><option value="">自动选择中文声音</option>{speech.voices.map(v => <option key={v.voiceURI} value={v.voiceURI}>{v.name}{v.localService ? ' · 本机' : ' · 在线'}</option>)}</select></label>}
                  {speech.metrics.firstAudioMs !== null && <span className="interviewLatency">本轮首响 {speech.metrics.firstAudioMs} ms · {speech.metrics.provider === 'browser' ? '浏览器' : '云端'}</span>}
                </div>}
                {speech.error && <p className="formHint" role="status">{speech.error}</p>}
              </div>

              {/* 反馈生成中 */}
              {st.stage === 'feedbacking' && (
                <div className="feedbacking"><div role="status"><span className="runningDot" />正在分析回答 · 已等待 {waitingSeconds} 秒<span className="formHint">{waitingSeconds >= 10 ? '模型响应较慢，回答已保留；可取消等待后重试或结束。' : '正在整理表达结构、行动证据与改进建议。'}</span></div><button className="btn outline sm" onClick={cancelFeedback}>取消等待 · 保留回答</button></div>
              )}

              {feedbackPreview && <div className="feedbackCard" role="status"><div className="questionLabel">{st.stage === 'feedback' ? '首段反馈' : '口语预览 · 详细报告尚未完成'}</div><p>{feedbackPreview.reply}</p><span className="interviewLatency">首段反馈 {(feedbackPreview.elapsedMs / 1000).toFixed(1)} 秒</span></div>}
              {/* 本轮反馈 */}
              {st.stage === 'feedback' && last && (
                <div className="feedbackCard">
                  <div className="feedbackScore">本轮得分 {last.feedback.score}/5</div>
                  {feedbackMs !== null && <p className="interviewLatency">模型反馈往返 {(feedbackMs / 1000).toFixed(1)} 秒 · 不含语音首响</p>}
                  <p className="formHint">练习参考评分，不代表招聘或录用判断。</p>
                  <div className="dims">
                    {last.feedback.dimensions.map((d, j) => (
                      <div key={j} className="dimRow"><span className="dimName">{d.name}</span><Stars n={d.stars} /></div>
                    ))}
                  </div>
                  {last.feedback.suggestions.map((s, j) => <div key={j} className="fbLine hint">· {s}</div>)}
                </div>
              )}

              <section className="interviewChat" aria-label="面试聊天记录" aria-live="polite">
                <div className="questionLabel">本次对话记录（保留至本次页面会话结束）</div>
                {(st.messages || []).map((message, i) => <div key={i} className={`interviewMessage ${message.role}`}>
                  <strong>{message.role === 'user' ? '你' : '小北 · 面试官'}</strong><p>{message.text}</p>
                </div>)}
              </section>
              {st.answerError && <p className="formHint" role="alert">{st.answerError}；可更正下方文字后重新提交。</p>}
              {/* 作答区 */}
              <div className="answerArea">
                {(st.mode === 'voice' || st.mode === 'video') && (
                  <button
                    className={`micBtn${st.micOn ? ' on' : ''}`}
                    onClick={() => { speech.stop(); setVoiceAuto(v => !v); setEditing(false); recognition.retry() }}
                  >
                    <IconMic size={20} />
                    {st.micOn ? <><Waveform />点击暂停收音</> : voiceAuto ? '自动语音对话中' : '继续语音对话'}
                  </button>
                )}
                {st.mode !== 'text' && <div className="formHint">
                  {!recognition.supported ? '当前浏览器不支持语音识别，请使用支持的 Chrome/Edge 或文字作答。' : recognition.error || (st.micOn ? autoSubmit ? '正在识别，完整转写稳定 1.8 秒后提交；可随时停止收音。' : '正在转写，默认不自动提交；说完后点击提交回答。' : '小北播报结束后自动开始收音。')}
                  <button className="btn ghost sm" onClick={() => { useInterviewStore.setState({ answerError: '' }); setVoiceAuto(true); setEditing(false); recognition.retry() }}>重试收音</button>
                  <button className="btn ghost sm" onClick={() => { speech.stop(); setEditing(true); setVoiceAuto(false) }}>文字更正 / 手动提交</button>
                  <label className="interviewAutoSubmit"><input type="checkbox" checked={autoSubmit} onChange={e => setAutoSubmit(e.target.checked)} />开启停顿自动提交（1.8 秒，仅完整转写）</label>
                  {recognition.interim && <span className="interviewInterim" role="status">临时转写：{recognition.interim}</span>}
                </div>}
                <div className="answerInput">
                  <textarea
                    className="composerInput"
                    aria-label="本题回答"
                    aria-describedby="interview-answer-length"
                    maxLength={4000}
                    rows={3}
                    placeholder={st.stage === 'feedbacking' ? '反馈生成中…' : st.stage === 'feedback' ? '点击「下一题」继续…' : '输入你的回答…（文字兜底，随时可改）'}
                    disabled={st.paused || st.finishing || st.stage !== 'asking'}
                    value={draft}
                    onFocus={() => { speech.stop(); setEditing(true); setVoiceAuto(false) }}
                    onChange={e => setDraft(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); submit() } }}
                  />
                  <span id="interview-answer-length" className="formHint">{draft.length} / 4000 字 · 仅完整提交后生成反馈</span>
                  <div className="answerActions">
                    <span className="formHint">{(st.mode === 'voice' || st.mode === 'video') ? '语音转写可先核对；点击输入框停止收音并更正' : 'Enter 提交，Shift+Enter 换行'}</span>
                    {st.stage === 'feedback' ? (
                      <div className="btnRow">
                        <button className="btn primary" disabled={st.paused || st.finishing} onClick={nextQuestion}>
                          {st.index + 1 >= total ? '查看复盘' : '下一题'}
                        </button>
                      </div>
                    ) : st.stage === 'feedbacking' ? (
                      <span className="formHint">正在生成反馈…</span>
                    ) : (
                      <button className="sendBtn" onClick={submit} disabled={!draft.trim() || st.paused || st.finishing || st.stage !== 'asking'}>
                        <IconSend size={14} />提交回答
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* 控制栏 */}
              <div className="interviewControls">
                {st.mode === 'video' && (
                  <button className="btn ghost sm" onClick={cameraOn ? stopCamera : startCamera}>
                    <IconVideo size={14} />{cameraOn ? '关闭摄像头' : '开启摄像头'}
                  </button>
                )}
                <button className="btn ghost sm" disabled={st.finishing || st.stage === 'feedbacking'} onClick={finish}><IconStop size={14} />结束</button>
                <button className="btn ghost sm" onClick={() => setDraft('')}><IconRefresh size={14} />清空</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
