import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { fetchCollege } from '../api.js'
import { IconArrowLeft } from '../components/Icons.jsx'

export default function CollegePage() {
  const { cid } = useParams()
  const navigate = useNavigate()
  const [college, setCollege] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    setError('')
    setCollege(null)
    fetchCollege(cid)
      .then(data => alive && setCollege(data))
      .catch(err => alive && setError(err.message || '加载失败'))
    return () => { alive = false }
  }, [cid])

  if (error) {
    return (
      <div className="page scrollable">
        <p className="empty" role="alert">{error}</p>
        <button className="btn ghost" onClick={() => navigate('/knowledge')}>返回知识库</button>
      </div>
    )
  }

  if (!college) {
    return (
      <div className="page scrollable">
        <p className="pageSub">加载中…</p>
      </div>
    )
  }

  return (
    <div className="page scrollable">
      <header className="pageHeader">
        <button className="btn ghost sm" onClick={() => navigate('/knowledge')} style={{ marginBottom: 10 }}>
          <IconArrowLeft size={14} />返回
        </button>
        <h1>{college.name}</h1>
        <p className="pageSub">{college.majors.length} 个本科专业</p>
      </header>

      <div className="majorList">
        {college.majors.map(m => (
          <Link key={m.id} to={`/knowledge/major/${m.id}`} className="majorCard">
            <div className="majorCardName">{m.name}</div>
            <div className="majorCardMeta">核心课程 {m.courses.length} 门</div>
          </Link>
        ))}
      </div>
    </div>
  )
}