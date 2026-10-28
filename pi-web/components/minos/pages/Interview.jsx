import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { createInterviewSession, fetchQuestions, fetchInterviewModels } from '../api.js'
import { useInterviewStore, useLearningStore } from '../store.js'
import { positions, difficulties, durations } from '../data/interview.js'
import { getInterviewChatContext } from '../../../lib/interview-chat-context'

// 画像方向 → 面试岗位默认值
const DIRECTION_POSITION = { '产品': '产品经理', '开发': '后端开发', '数据': '数据分析', '设计': '产品经理', '运营': '产品经理' }

export default function Interview() {
  const navigate = useNavigate()
  const location = useLocation()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [chatContext] = useState(() => getInterviewChatContext())
  const [catalog, setCatalog] = useState(null)
  const [modelError, setModelError] = useState('')
  const [modelChoice, setModelChoice] = useState('')
  useEffect(() => {
    const controller = new AbortController()
    fetchInterviewModels(controller.signal, chatContext?.cwd).then(setCatalog).catch(err => { if (!controller.signal.aborted) setModelError(err.message) })
    return () => controller.abort()
  }, [])
  const chosenModel = catalog?.models?.find(m => JSON.stringify([m.provider, m.modelId]) === modelChoice)
  const automaticRef = chatContext?.model || catalog?.defaultModel
  const automaticModel = catalog?.models?.find(m => m.provider === automaticRef?.provider && m.modelId === automaticRef?.modelId)
  const effectiveModel = modelChoice ? chosenModel : automaticModel
  const prefix = location.pathname.startsWith('/embedded/') ? '/embedded' : ''
  const profile = useLearningStore(s => s.profile)

  const [position, setPosition] = useState(DIRECTION_POSITION[profile.direction] || positions[0])
  const [difficulty, setDifficulty] = useState(difficulties[0])
  const [duration, setDuration] = useState(durations[1])
  const [mode, setMode] = useState('video') // text | voice | video；默认面对面练习

  const start = async () => {
    if (busy || !effectiveModel?.supported) return
    setBusy(true)
    setError('')
    try {
      const remote = await fetchQuestions(position, difficulty)
      if (!Array.isArray(remote.items) || !remote.items.length || remote.items.some(q => typeof q !== 'string' || !q.trim())) {
        throw new Error('服务端题库暂不可用，请重试')
      }
      const session = await createInterviewSession({ position, difficulty, durationMinutes: parseInt(duration, 10), answerMode: mode })
      if (!session.id || !Array.isArray(session.questions) || !session.questions.length || session.questions.some(q => !q.id || typeof q.text !== 'string' || !q.text.trim())) throw new Error('服务端未返回有效面试会话或题目，请重试')
      useInterviewStore.setState({
        feedbackModel: { provider: effectiveModel.provider, modelId: effectiveModel.modelId }, feedbackCwd: chatContext?.cwd || null,
        position, difficulty, mode, duration, questions: session.questions.map(q => q.text), questionIds: session.questions.map(q => q.id), sessionId: session.id,
        index: 0, transcript: [], stage: 'asking', phase: 'prepare', followup: null,
        paused: false, messages: [], answerError: '', micOn: false, pendingAnswer: null,
        finishError: '', finishing: false, finished: false, serverReport: null,
      })
      navigate(`${prefix}/interview/room`)
    } catch (err) {
      setError(err.message || '创建面试失败，请重试；当前配置已保留')
    } finally { setBusy(false) }
  }

  return (
    <div className="page scrollable">
      <header className="pageHeader">
        <h1>AI 模拟面试</h1>
        <p className="pageSub">逐题练习，即时反馈。</p>
      </header>

      <section className="formSection">
        <label className="sectionTitle" htmlFor="interview-model">面试反馈模型</label>
        <select id="interview-model" value={modelChoice} onChange={event => setModelChoice(event.target.value)} disabled={!catalog}>
          <option value="">{chatContext?.model ? '复用当前对话模型' : '复用 Pi 默认模型'}{automaticModel ? ` · ${automaticModel.name}` : ''}</option>
          {(catalog?.models || []).map(m => <option key={JSON.stringify([m.provider, m.modelId])} value={JSON.stringify([m.provider, m.modelId])} disabled={!m.supported}>{m.provider} / {m.name}{m.supported ? '' : '（暂不兼容）'}</option>)}
        </select>
        <p className="formHint">优先复用本页当前对话模型及其工作区设置；没有当前对话时使用 Pi 默认。无需重复填密钥，认证仅在服务端使用。选择后本次面试固定使用该模型；不可用时不会静默切换供应商。</p>
        {!catalog && !modelError && <p className="formHint" role="status">正在读取 Pi 模型…</p>}
        {(modelError || (catalog && !effectiveModel?.supported)) && <p className="formHint" role="alert">{modelError || effectiveModel?.reason || '尚无可用面试模型，请先在对话模型设置中配置，或明确选择兼容模型。'} 不会静默换用其他供应商。</p>}
      </section>

      <section className="formSection">
        <div className="sectionTitle">目标岗位</div>
        <div className="chipRow">
          {positions.map(p => (
            <button key={p} aria-pressed={position === p} className={`chip${position === p ? ' on' : ''}`} onClick={() => setPosition(p)}>{p}</button>
          ))}
        </div>
      </section>

      <section className="formSection">
        <div className="sectionTitle">难度</div>
        <div className="chipRow">
          {difficulties.map(d => (
            <button key={d} className={`chip${difficulty === d ? ' on' : ''}`} onClick={() => setDifficulty(d)}>{d}</button>
          ))}
        </div>
      </section>

      <section className="formSection">
        <div className="sectionTitle">作答方式</div>
        <div className="chipRow">
          <button aria-pressed={mode === 'video'} className={`chip${mode === 'video' ? ' on' : ''}`} onClick={() => setMode('video')}>面对面 · 视频</button>
          <button aria-pressed={mode === 'voice'} className={`chip${mode === 'voice' ? ' on' : ''}`} onClick={() => setMode('voice')}>语音</button>
          <button aria-pressed={mode === 'text'} className={`chip${mode === 'text' ? ' on' : ''}`} onClick={() => setMode('text')}>文字</button>
        </div>
        {mode !== 'text' && (
          <div className="formHint">
            <p>{mode === 'video' ? '面对面模式展示面试官与本机摄像头预览。' : ''}语音通过浏览器真实实时转写，面试官按轮播报；请等播报结束、显示收音状态后回答。不是全双工实时通话，暂不支持边播报边打断。</p>
            <p>{mode === 'video' ? '需分别允许摄像头与麦克风权限。' : '需允许麦克风权限。'}请使用支持语音识别的浏览器（如 Chrome / Edge），并通过 HTTPS 或 localhost 访问；麦克风测试通过不代表在线语音识别服务可用。</p>
            <p>语音识别可能将音频发送至浏览器厂商的在线服务，需可用网络；面试反馈和云端播报也依赖网络。转写文字提交模型并保留问答记录。识别不可用时可重试、用文字更正或切换文字作答；摄像头仅用于本机预览。</p>
          </div>
        )}
      </section>

      <details className="formSection">
        <summary className="sectionTitle">高级选项 · {duration}</summary>
        <div className="sectionTitle">时长</div>
        <div className="chipRow">
          {durations.map(d => (
            <button key={d} className={`chip${duration === d ? ' on' : ''}`} onClick={() => setDuration(d)}>{d}</button>
          ))}
        </div>
      </details>

      {error && <p className="formHint" role="alert">{error} 配置已保留，可重试。</p>}
      <button className="btn primary big" disabled={busy || !effectiveModel?.supported} onClick={start}>{busy ? '正在创建面试…' : error ? '重试开始面试' : '开始面试'}</button>
    </div>
  )
}
