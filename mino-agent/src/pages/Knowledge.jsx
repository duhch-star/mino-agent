import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchGuides, fetchColleges } from '../api.js'

export default function Knowledge() {
  const [guides, setGuides] = useState(null)
  const [colleges, setColleges] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    Promise.all([fetchGuides().catch(() => []), fetchColleges().catch(() => [])])
      .then(([guideData, collegeData]) => {
        if (!alive) return
        setGuides(guideData)
        setColleges(collegeData)
      })
      .catch(err => alive && setError(err.message || '加载失败'))
    return () => { alive = false }
  }, [])

  return (
    <div className="page scrollable">
      <header className="pageHeader">
        <h1>知识库</h1>
        <p className="pageSub">按学院浏览专业与核心课程，为简历与面试提炼能力关键词</p>
      </header>

      {error && <p className="empty">{error}</p>}

      {/* 求职指南 */}
      <section>
        <h2 className="sectionTitle">求职指南</h2>
        {guides === null
          ? <p className="formHint">加载中…</p>
          : guides.length > 0
            ? (
              <div className="chapterGrid">
                {guides.map(c => (
                  <Link key={c.id} to={`/guide/${c.id}`} className="chapterCard">
                    <div className="chapterCardTitle">{c.title}</div>
                    <div className="chapterCardMeta">{c.difficulty} · {c.readTime || ''}</div>
                  </Link>
                ))}
              </div>
            )
            : <p className="empty">暂无求职指南</p>}
      </section>

      {/* 学院列表 */}
      <section>
        <h2 className="sectionTitle">各学院专业（{colleges ? `${colleges.length} 个学院` : '…'}）</h2>
        {colleges === null
          ? <p className="formHint">加载中…</p>
          : colleges.length > 0
            ? (
              <div className="collegeGrid">
                {colleges.map(c => (
                  <Link key={c.id} to={`/knowledge/college/${c.id}`} className="collegeCard">
                    <div className="collegeCardName">{c.name}</div>
                    <div className="collegeCardMeta">{c.majors.length} 个专业</div>
                  </Link>
                ))}
              </div>
            )
            : <p className="empty">暂无学院数据</p>}
      </section>
    </div>
  )
}