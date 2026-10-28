import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchGuides, fetchColleges } from '../api.js'
import '../styles/pi-knowledge.css'

export default function Knowledge() {
  const [data, setData] = useState({ guides: [], colleges: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [query, setQuery] = useState('')
  const [tab, setTab] = useState('guides')
  useEffect(() => {
    let alive = true
    setLoading(true); setError('')
    Promise.all([fetchGuides(), fetchColleges()]).then(([guides, colleges]) => {
      if (alive) setData({guides:Array.isArray(guides)?guides:[],colleges:Array.isArray(colleges)?colleges:[]})
    }).catch(err => { if (alive) setError(err.message || '知识库加载失败') }).finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [attempt])
  const keyword = query.trim().toLocaleLowerCase()
  const guides = data.guides.filter(item => `${item.title} ${(item.tags || []).join(' ')}`.toLocaleLowerCase().includes(keyword))
  const colleges = data.colleges.filter(item => `${item.name} ${(item.majors || []).map(m=>m.name).join(' ')}`.toLocaleLowerCase().includes(keyword))
  return <main className="page scrollable piKnowledge">
    <header className="piKnowledgeHeader"><div><h1>知识库</h1><p>求职方法、专业课程与能力梳理，按需查阅。</p></div><button type="button" className="btn outline sm" onClick={()=>setAttempt(n=>n+1)} disabled={loading}>刷新</button></header>
    <div className="piKnowledgeToolbar"><div role="tablist" aria-label="知识分类"><button type="button" role="tab" aria-selected={tab==='guides'} aria-controls="knowledge-results" onClick={()=>setTab('guides')}>求职指南 <span>{data.guides.length}</span></button><button type="button" role="tab" aria-selected={tab==='colleges'} aria-controls="knowledge-results" onClick={()=>setTab('colleges')}>专业与课程 <span>{data.colleges.length}</span></button></div><input type="search" aria-label="搜索知识库" placeholder="搜索指南、学院或专业…" value={query} onChange={e=>setQuery(e.target.value)} /></div>
    {error ? <div role="alert" className="piKnowledgeEmpty"><p>{error}</p><button className="btn outline sm" onClick={()=>setAttempt(n=>n+1)}>重新加载</button></div> : loading ? <p role="status" className="piKnowledgeEmpty">正在加载知识库…</p> : <section id="knowledge-results" role="tabpanel" className="piKnowledgeList" aria-label={tab==='guides'?'求职指南':'专业与课程'}>
      <div className="piKnowledgeListHeader"><span>{tab==='guides'?'名称 / 主题':'学院 / 专业'}</span><span>{tab==='guides'?'难度 · 阅读时间':'专业数量'}</span></div>
      {tab==='guides' ? guides.map(c=><Link key={c.id} to={`/guide/${c.id}`} className="piKnowledgeRow"><span className="piKnowledgeDoc" aria-hidden="true">▤</span><span className="piKnowledgeRowBody"><strong>{c.title}</strong>{c.tags?.length>0&&<small>{c.tags.join(' · ')}</small>}</span><span className="piKnowledgeMeta">{c.difficulty} · {c.readTime || '未标注'}</span><span aria-hidden="true">›</span></Link>) : colleges.map(c=><Link key={c.id} to={`/knowledge/college/${c.id}`} className="piKnowledgeRow"><span className="piKnowledgeDoc" aria-hidden="true">▧</span><span className="piKnowledgeRowBody"><strong>{c.name}</strong><small>{(c.majors||[]).slice(0,3).map(m=>m.name).join(' · ')}</small></span><span className="piKnowledgeMeta">{c.majors?.length||0} 个专业</span><span aria-hidden="true">›</span></Link>)}
      {(tab==='guides'?guides:colleges).length===0&&<p className="piKnowledgeEmpty">{keyword?'没有匹配结果，试试其他关键词。':'暂无内容。'}</p>}
    </section>}
  </main>
}
