import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useInterviewStore, useLearningStore } from '../store.js'
import { positions, difficulties, durations } from '../data/interview.js'

// 画像方向 → 面试岗位默认值
const DIRECTION_POSITION = { '产品': '产品经理', '开发': '后端开发', '数据': '数据分析', '设计': '产品经理', '运营': '产品经理' }

export default function Interview() {
  const navigate = useNavigate()
  const configure = useInterviewStore(s => s.configure)
  const profile = useLearningStore(s => s.profile)

  const [position, setPosition] = useState(DIRECTION_POSITION[profile.direction] || positions[0])
  const [difficulty, setDifficulty] = useState(difficulties[0])
  const [duration, setDuration] = useState(durations[1])
  const [mode, setMode] = useState('video') // video voice-first | voice | text

  const start = async () => {
    await configure(position, difficulty, mode, duration)
    navigate('/interview/room')
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

      <button className="btn primary big" onClick={start}>开始面试</button>
    </div>
  )
}
