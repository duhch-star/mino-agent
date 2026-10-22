import { Link } from 'react-router-dom'
import { colleges } from '../data/colleges.js'
import { chapters } from '../data/chapters.js'

export default function Knowledge() {
  return (
    <div className="page scrollable">
      <header className="pageHeader">
        <h1>知识库</h1>
        <p className="pageSub">按学院浏览专业与核心课程，为简历与面试提炼能力关键词</p>
      </header>

      {/* 求职指南 */}
      <section>
        <h2 className="sectionTitle">求职指南</h2>
        <div className="chapterGrid">
          {chapters.map(c => (
            <Link key={c.id} to={`/guide/${c.id}`} className="chapterCard">
              <div className="chapterCardTitle">{c.title}</div>
              <div className="chapterCardMeta">{c.difficulty} · {c.readTime}</div>
            </Link>
          ))}
        </div>
      </section>

      {/* 学院列表 */}
      <section>
        <h2 className="sectionTitle">各学院专业（{colleges.length} 个学院）</h2>
        <div className="collegeGrid">
          {colleges.map(c => (
            <Link key={c.id} to={`/knowledge/college/${c.id}`} className="collegeCard">
              <div className="collegeCardName">{c.name}</div>
              <div className="collegeCardMeta">{c.majors.length} 个专业</div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}
