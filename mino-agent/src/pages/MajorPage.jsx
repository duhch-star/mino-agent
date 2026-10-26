import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { fetchMajor, fetchTextbookGroups } from '../api.js'
import { IconArrowLeft } from '../components/Icons.jsx'
import TextbookTree from '../components/TextbookTree.jsx'

export default function MajorPage() {
  const { mid } = useParams()
  const navigate = useNavigate()
  const [result, setResult] = useState(null)
  const [textbooks, setTextbooks] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    setError('')
    setResult(null)
    Promise.all([fetchMajor(mid), fetchTextbookGroups().catch(() => [])])
      .then(([majorData, textbookData]) => {
        if (!alive) return
        setResult(majorData)
        setTextbooks(textbookData)
      })
      .catch(err => alive && setError(err.message || '加载失败'))
    return () => { alive = false }
  }, [mid])

  if (error) {
    return (
      <div className="page scrollable">
        <p className="empty" role="alert">{error}</p>
        <button className="btn ghost" onClick={() => navigate('/knowledge')}>返回知识库</button>
      </div>
    )
  }

  if (!result) {
    return (
      <div className="page scrollable">
        <p className="pageSub">加载中…</p>
      </div>
    )
  }

  const { college, major } = result
  const showTextbooks = college.id === 'shuxue'

  return (
    <div className="page scrollable">
      <header className="pageHeader">
        <button className="btn ghost sm" onClick={() => navigate(`/knowledge/college/${college.id}`)} style={{ marginBottom: 10 }}>
          <IconArrowLeft size={14} />{college.name}
        </button>
        <h1>{major.name}</h1>
        <p className="pageSub">核心课程 · 求职能力 · 适配岗位</p>
      </header>

      {/* 核心课程 */}
      <section>
        <h2 className="sectionTitle">核心课程（{major.courses.length} 门）</h2>
        <div className="chipRow">
          {major.courses.map(c => <span key={c} className="tag big">{c}</span>)}
        </div>
      </section>

      {/* AI 求职分析 */}
      <section>
        <h2 className="sectionTitle">AI 求职分析</h2>
        {major.keywords ? (
          <>
            <div className="aiBlock">
              <div className="aiLabel">求职能力关键词</div>
              <div className="chipRow">
                {major.keywords.map(k => <span key={k} className="tag big">{k}</span>)}
              </div>
            </div>
            <div className="aiBlock">
              <div className="aiLabel">适配岗位</div>
              <div className="chipRow">
                {major.positions.map(p => <span key={p} className="tag big">{p}</span>)}
              </div>
            </div>
          </>
        ) : (
          <p className="formHint">该专业的能力关键词与适配岗位将由 AI 按「核心课程」生成（后端接入后展示）。</p>
        )}
      </section>

      {/* 教材章节目录（仅数学与信息科学学院） */}
      {showTextbooks && (
        <section>
          <h2 className="sectionTitle">教材章节目录</h2>
          <TextbookTree groups={textbooks} />
        </section>
      )}
    </div>
  )
}