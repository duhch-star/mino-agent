import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { createInterviewSession, fetchQuestions } from '../api.js'
import { useInterviewStore, useLearningStore } from '../store.js'
import { positions, difficulties, durations } from '../data/interview.js'

// 画像方向 → 面试岗位默认值
const DIRECTION_POSITION = { '产品': '产品经理', '开发': '后端开发', '数据': '数据分析', '设计': '产品经理', '运营': '产品经理' }

export default function Interview() {
  const navigate = useNavigate()
  const location = useLocation()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const prefix = location.pathname.startsWith('/embedded/') ? '/embedded' : ''
  const profile = useLearningStore(s => s.profile)

  const [position, setPosition] = useState(DIRECTION_POSITION[profile.direction] || positions[0])
  const [difficulty, setDifficulty] = useState(difficulties[0])
  const [duration, setDuration] = useState(durations[1])
  const [mode, setMode] = useState('video') // video voice-first | voice | text

  const start = async () => {
    if (busy) return
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
        <p className="pageSub">MINO AGENT 当面试官，逐题提问、追问、给反馈。全程可暂停，可切文字兜底。</p>
      </header>

      <section className="formSection">
        <div className="sectionTitle">目标岗位</div>
        <div className="chipRow">
          {positions.map(p => (
            <button key={p} className={`chip${position === p ? ' on' : ''}`} onClick={() => setPosition(p)}>{p}</button>
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
        <div className="sectionTitle">时长</div>
        <div className="chipRow">
          {durations.map(d => (
            <button key={d} className={`chip${duration === d ? ' on' : ''}`} onClick={() => setDuration(d)}>{d}</button>
          ))}
        </div>
      </section>

      <section className="formSection">
        <div className="sectionTitle">作答方式</div>
        <div className="chipRow">
          <button className={`chip${mode === 'voice' ? ' on' : ''}`} onClick={() => setMode('voice')}>语音</button>
          <button className={`chip${mode === 'video' ? ' on' : ''}`} onClick={() => setMode('video')}>视频</button>
          <button className={`chip${mode === 'text' ? ' on' : ''}`} onClick={() => setMode('text')}>文字</button>
        </div>
        <p className="formHint">
          {mode === 'video'
            ? '默认视频语音对话：小北播报，你开口回答；转写后提交大模型，并保留双方聊天记录。进入房间时请求授权。'
            : mode === 'voice'
              ? '语音作答需授权麦克风；识别可随时用文字更正。'
              : '文字作答最稳，适合安静练习。'}
        </p>
      </section>

      {error && <p className="formHint" role="alert">{error}</p>}
      <button className="btn primary big" disabled={busy} onClick={start}>{busy ? '正在创建面试…' : error ? '重试开始面试' : '开始面试'}</button>
    </div>
  )
}
