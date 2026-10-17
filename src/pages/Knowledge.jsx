import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { chapters } from '../data/chapters.js'

export default function Knowledge() {
  const [query, setQuery] = useState('')

  const list = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return chapters
    return chapters.filter(c =>
      c.title.toLowerCase().includes(q)
      || c.tags.some(t => t.toLowerCase().includes(q))
      || c.content.toLowerCase().includes(q),
    )
  }, [query])

  return (
    <div className="page scrollable">
      <header className="pageHeader">
        <h1>知识库</h1>
        <p className="pageSub">系统化求职知识，章节互相链接，按需补课</p>
      </header>

      <input
        className="searchInput"
        placeholder="搜索章节或标签，如 STAR / 简历"
        value={query}
        onChange={e => setQuery(e.target.value)}
      />

      <div className="chapterGrid">
        {list.map(c => (
          <Link key={c.id} to={`/knowledge/${c.id}`} className="chapterCard">
            <div className="chapterCardTitle">{c.title}</div>
            <div className="chapterCardMeta">{c.difficulty} · {c.readTime} · 更新 {c.updated}</div>
            <div className="tagRow">
              {c.tags.map(t => <span key={t} className="tag">{t}</span>)}
            </div>
          </Link>
        ))}
        {list.length === 0 && <p className="empty">没有匹配的章节</p>}
      </div>
    </div>
  )
}
