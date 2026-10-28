import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchGuides } from '../api.js'
import { useLearningStore } from '../store.js'
export default function LearningReview() {
  const { progress, bookmarks, notes, quizResults, syncError } = useLearningStore()
  const [guides, setGuides] = useState([])
  const [error, setError] = useState('')
  useEffect(() => { let alive = true; fetchGuides().then(items => { if (alive) setGuides(items) }).catch(e => { if (alive) setError(e.message) }); return () => { alive = false } }, [])
  const items = guides.filter(g => progress[g.id] || bookmarks.includes(g.id) || notes[g.id] || quizResults[g.id])
  return <main className="page scrollable piKnowledge"><header className="piKnowledgeHeader"><div><h1>学习复盘</h1><p>同一账号的阅读进度、收藏、笔记与测验记录。</p></div></header>
    {(error || syncError) && <p role="alert">{error || syncError}</p>}
    {items.length ? items.map(g => <article key={g.id} className="minos-learning-item"><Link to={`/guide/${g.id}`}>{g.title}</Link><span>阅读 {Math.round((progress[g.id] || 0) * 100)}% {bookmarks.includes(g.id) ? ' · 已收藏' : ''}</span>{quizResults[g.id] && <small>测验 {quizResults[g.id].score} / {quizResults[g.id].total}</small>}{notes[g.id] && <p>{notes[g.id]}</p>}</article>) : <p className="piKnowledgeEmpty">还没有学习记录，<Link to="/knowledge">去知识库开始学习</Link>。</p>}
  </main>
}
