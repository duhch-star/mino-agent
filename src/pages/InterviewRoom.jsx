import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useInterviewStore } from '../store.js'
import { chapterById } from '../data/chapters.js'
import { XiaominMark } from '../components/XiaominMark.jsx'
import { IconMic, IconSend, IconStop, IconPause, IconArrowLeft, IconRefresh, IconCheck, IconBook, IconVideo } from '../components/Icons.jsx'

// 懒加载 3D 角色组件：three.js 只在进入面试房间时才下载
const CharacterView = lazy(() => import('../components/CharacterView.jsx'))

function CharacterFallback() {
  return (
    <div className="characterFallback">
      <div className="characterAvatar"><XiaominMark size={72} /></div>
      <div className="characterName">MINO AGENT</div>
    </div>
  )
}

function Stars({ n }) {
  return <span className="stars">{'★'.repeat(Math.max(0, n))}{'☆'.repeat(Math.max(0, 5 - n))}</span>
}

// 面试状态 → 角色动画
function characterFor(phase, stage, micOn, typing) {
  if (phase === 'report') return 'encourage'
  if (phase === 'running') {
    if (stage === 'feedback') return 'encourage'
    if (micOn || typing) return 'listen'
    return 'talk'
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

  const testMic = async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true })
      setMicStatus('ok')
    } catch {
      setMicStatus('fail')
    }
  }

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
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
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

  const character = characterFor(st.phase, st.stage, st.micOn, typing)
  const speaking = st.phase === 'running' && st.stage === 'asking' && !st.micOn && !typing

  const submit = () => {
    if (!draft.trim()) return
    st.submitAnswer(draft)
    setDraft('')
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
                  <IconBook size={14} />去补课：{chapterById(t.feedback.chapterId)?.title}
                </Link>
              </div>
            </div>
          ))}

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
          <Suspense fallback={<CharacterFallback />}>
            <CharacterView state={character} speaking={speaking} />
          </Suspense>
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

              {/* 作答区 */}
              <div className="answerArea">
                {(st.mode === 'voice' || st.mode === 'video') && (
                  <button
                    className={`micBtn${st.micOn ? ' on' : ''}`}
                    onClick={() => st.setMic(!st.micOn)}
                  >
                    <IconMic size={20} />
                    {st.micOn ? <Waveform /> : '按住说话'}
                  </button>
                )}
                <div className="answerInput">
                  <textarea
                    className="composerInput"
                    rows={3}
                    placeholder={st.stage === 'feedbacking' ? '反馈生成中…' : st.stage === 'feedback' ? '点击「下一题」继续…' : '输入你的回答…（文字兜底，随时可改）'}
                    value={draft}
                    onChange={e => setDraft(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() } }}
                  />
                  <div className="answerActions">
                    <span className="formHint">{(st.mode === 'voice' || st.mode === 'video') ? '语音识别接入中，可先用文字输入' : 'Enter 提交，Shift+Enter 换行'}</span>
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
