import { useEffect, useRef, useState } from 'react'
import CharacterView from '../components/CharacterView.jsx'
import { useInterviewSpeech } from '../lib/useInterviewSpeech.js'
import { useInterviewRecognition } from '../lib/useInterviewRecognition.js'
import { Link, useNavigate } from 'react-router-dom'
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
  const st = useInterviewStore()
  const [draft, setDraft] = useState('')
  const [micStatus, setMicStatus] = useState('')
  const [saveRecord, setSaveRecord] = useState(false)
  const [voiceAuto, setVoiceAuto] = useState(true)
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
    if (cameraOn && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current
    }
  }, [cameraOn])

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
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
    if (st.phase === 'config' && st.questions.length === 0) navigate('/interview')
  }, [st.phase, st.questions.length, navigate])

  const total = st.questions.length
  const question = st.followup || st.questions[st.index] || ''
  const last = st.transcript[st.transcript.length - 1]
  const typing = draft.trim().length > 0

  const spokenText = st.stage === 'feedback' ? (last?.feedback.reply || '') : question
  const speech = useInterviewSpeech({ phase: st.phase, stage: st.stage, question: spokenText, index: st.index,
    paused: st.paused, mode: st.mode, micOn: false, typing: editing })
  const recognition = useInterviewRecognition({
    active: voiceAuto && !editing && st.mode !== 'text' && st.phase === 'running' && st.stage === 'asking' && !st.paused && speech.readyForAnswer && !st.answerError,
    onText: setDraft,
    onListening: st.setMic,
    onAnswer: async text => { const ok = await st.submitAnswer(text); if (ok) setDraft('') },
  })
  useEffect(() => { setDraft(''); setEditing(false) }, [st.index, st.followup])
  const character = st.paused ? 'idle' : speech.status === 'generating' ? 'think'
    : speech.status === 'playing' ? 'talk' : characterFor(st.phase, st.stage, st.micOn, typing)

  const submit = async () => {
    if (!draft.trim()) return
    setVoiceAuto(false)
    const ok = await st.submitAnswer(draft)
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
          <button className="iconButton" onClick={() => navigate('/interview')} aria-label="退出"><IconArrowLeft size={16} /></button>
          <div className="interviewTopTitle">{st.position} · 面试复盘</div>
          <div className="interviewTopMeta">{st.transcript.length} 题 · 平均 {avg} 分</div>
        </header>

        <div className="reportView">
          <div className="reportHead">
            <h1>面试复盘</h1>
            <p className="pageSub">MINO AGENT 基于你的回答给出的训练建议（仅供参考，不构成录用判断）</p>
            <div className="saveRecord">
              <span className="formHint">保存本次转写与记录（仅本地）</span>
              <button className={`switch${saveRecord ? ' on' : ''}`} onClick={() => setSaveRecord(v => !v)} role="switch" aria-checked={saveRecord} />
            </div>
          </div>

          {st.transcript.map((t, i) => (
            <div key={i} className="reportItem">
              <div className="reportQ"><span className="reportIdx">Q{i + 1}</span>{t.q}</div>
              <div className="reportA">{t.a}</div>
              <div className="reportFb">
                <div className="reportScore">综合 {t.feedback.score}/5</div>
                <div className="dims">
                  {t.feedback.dimensions.map((d, j) => (
                    <div key={j} className="dimRow">
                      <span className="dimName">{d.name}</span>
                      <Stars n={d.stars} />
                      <span className="dimNote">{d.note}</span>
                    </div>
                  ))}
                </div>
                {t.feedback.strengths.map((s, j) => <div key={j} className="fbLine good"><IconCheck size={14} />{s}</div>)}
                {t.feedback.suggestions.map((s, j) => <div key={j} className="fbLine hint">· {s}</div>)}
                <div className="starExample">
                  <div className="starExampleTitle">STAR 改写示例</div>
                  <pre>{t.feedback.starExample}</pre>
                </div>
                <Link to={`/guide/${t.feedback.chapterId}`} className="btn outline sm goStudy">
                  <IconBook size={14} />去补课：{getChapterTitle(t.feedback.chapterId)}
                </Link>
              </div>
            </div>
          ))}

          <section className="interviewChat" aria-label="完整面试聊天记录">
            <div className="questionLabel">本次完整对话记录</div>
            {(st.messages || []).map((message, i) => <div key={i} className={`interviewMessage ${message.role}`}><strong>{message.role === 'user' ? '你' : '小北 · 面试官'}</strong><p>{message.text}</p></div>)}
          </section>
          <div className="reportActions">
            <button className="btn primary" onClick={st.reset}>再来一次</button>
            <button className="btn ghost" onClick={() => navigate('/knowledge')}>去知识库补课</button>
          </div>
        </div>
      </div>
    )
  }

  // —— 准备 / 进行中 ——
  return (
    <div className="interviewRoom">
      <header className="interviewTop">
        <button className="iconButton" onClick={() => navigate('/interview')} aria-label="退出"><IconArrowLeft size={16} /></button>
        <div className="interviewTopTitle">{st.position} · {st.difficulty}</div>
        <div className="interviewTopMeta">
          {st.phase === 'running' ? `第 ${st.index + 1}/${total} 题 · ${st.duration}` : st.duration}
        </div>
        {st.phase === 'running' && (
          <>
            <button className="btn ghost sm" onClick={st.togglePause}>{st.paused ? '继续' : '暂停'}</button>
            <button className="btn ghost sm" onClick={st.end}>结束面试</button>
          </>
        )}
      </header>

      <div className="interviewBody">
        <div className="interviewCharacter">
          <CharacterView state={character} audioUrl={speech.audioUrl}
            onPlaybackEnd={() => { speech.onPlaybackEnd(); if (st.stage === 'feedback' && voiceAuto && !st.paused) st.nextQuestion() }} onPlaybackError={speech.onPlaybackError} />
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
              {st.mode !== 'text' && <p className="formHint">提问将由曼波语音播报，题目文字会发送至第三方语音服务；可在面试中关闭播报。用户语音由浏览器识别服务转成文字后提交大模型；仅在小北停止播报后收音。请使用支持语音识别的浏览器，并尽量佩戴耳机。</p>}
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
                  <button className="btn ghost" onClick={() => st.setMode('text')}>改用文字/语音</button>
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
                  <button className="btn ghost sm" disabled={!speech.enabled || st.paused || st.stage !== 'asking' || speech.status !== 'idle'} onClick={speech.replay}>重播问题</button>
                  <span className="formHint">{speech.status === 'generating' ? '曼波语音生成中…' : speech.status === 'playing' ? '小北正在播报…' : '曼波加速语音'}</span>
                </div>}
                {speech.error && <p className="formHint" role="status">{speech.error}</p>}
              </div>

              {/* 反馈生成中 */}
              {st.stage === 'feedbacking' && (
                <div className="feedbacking"><span className="runningDot" />正在生成反馈…</div>
              )}

              {/* 本轮反馈 */}
              {st.stage === 'feedback' && last && (
                <div className="feedbackCard">
                  <div className="feedbackScore">本轮得分 {last.feedback.score}/5</div>
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
                    onClick={() => { setVoiceAuto(v => !v); setEditing(false); recognition.retry() }}
                  >
                    <IconMic size={20} />
                    {st.micOn ? <><Waveform />点击暂停收音</> : voiceAuto ? '自动语音对话中' : '继续语音对话'}
                  </button>
                )}
                {st.mode !== 'text' && <div className="formHint">
                  {!recognition.supported ? '当前浏览器不支持语音识别，请使用支持的 Chrome/Edge 或文字作答。' : recognition.error || (st.micOn ? '正在识别；本次说话结束后自动提交。长回答建议使用文字更正后提交。' : '小北播报结束后自动开始收音。')}
                  <button className="btn ghost sm" onClick={() => { setVoiceAuto(true); setEditing(false); recognition.retry() }}>重试收音</button>
                  <button className="btn ghost sm" onClick={() => { setEditing(true); setVoiceAuto(false) }}>文字更正 / 手动提交</button>
                </div>}
                <div className="answerInput">
                  <textarea
                    className="composerInput"
                    rows={3}
                    placeholder={st.stage === 'feedbacking' ? '反馈生成中…' : st.stage === 'feedback' ? '点击「下一题」继续…' : '输入你的回答…（文字兜底，随时可改）'}
                    value={draft}
                    onFocus={() => { setEditing(true); setVoiceAuto(false) }}
                    onChange={e => setDraft(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() } }}
                  />
                  <div className="answerActions">
                    <span className="formHint">{(st.mode === 'voice' || st.mode === 'video') ? '语音自动转写提交；点击输入框可停止收音并更正' : 'Enter 提交，Shift+Enter 换行'}</span>
                    {st.stage === 'feedback' ? (
                      <div className="btnRow">
                        <button className="btn ghost" onClick={st.followUp}>追问</button>
                        <button className="btn primary" onClick={st.nextQuestion}>
                          {st.index + 1 >= total ? '查看复盘' : '下一题'}
                        </button>
                      </div>
                    ) : st.stage === 'feedbacking' ? (
                      <span className="formHint">正在生成反馈…</span>
                    ) : (
                      <button className="sendBtn" onClick={submit} disabled={!draft.trim()}>
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
                <button className="btn ghost sm" onClick={st.end}><IconStop size={14} />结束</button>
                <button className="btn ghost sm" onClick={() => setDraft('')}><IconRefresh size={14} />清空</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
