import { Link } from 'react-router-dom'
import { chapters, learningPath } from '../data/chapters.js'
import { useLearningStore } from '../store.js'
import { XiaominMark } from '../components/XiaominMark.jsx'
import { IconBook, IconMic, IconBriefcase, IconChat } from '../components/Icons.jsx'

const QUICK = [
  { to: '/interview', label: '开始模拟面试', desc: 'MINO AGENT 当面试官，逐题练习', icon: IconMic },
  { to: '/knowledge', label: '浏览知识库', desc: '系统学习求职知识章节', icon: IconBook },
  { to: '/career', label: '职业辅导', desc: '简历优化与岗位匹配', icon: IconBriefcase },
  { to: '/chat', label: '问问 MINO AGENT', desc: '随时提问，得到针对性建议', icon: IconChat },
]

export default function Home() {
  const progress = useLearningStore(s => s.progress)
  const profile = useLearningStore(s => s.profile)
  const inProgress = chapters.filter(c => progress[c.id])
  const hasProfile = profile.direction && profile.direction !== '未设置'

  return (
    <div className="page scrollable">
      <header className="pageHeader">
        <h1>你好{hasProfile ? `，${profile.direction}方向求职者` : '，求职者'} 👋</h1>
        <p className="pageSub">
          {hasProfile
            ? `${profile.direction} · ${profile.level} · MINO AGENT 陪你系统学习、模拟面试、打磨简历`
            : 'MINO AGENT 陪你系统学习、模拟面试、打磨简历'}
        </p>
        {!hasProfile && (
          <Link to="/onboarding" className="btn ghost sm" style={{ marginTop: 10 }}>完善画像</Link>
        )}
      </header>

      {/* MINO AGENT 陪伴 */}
      <div className="coachCard">
        <div className="coachAvatar"><XiaominMark size={40} /></div>
        <div>
          <div className="coachText">MINO AGENT 说：先掌握 <b>STAR 结构</b>，再去做一轮模拟面试，效果最好。</div>
          <Link to="/interview" className="btn outline sm" style={{ marginTop: 8 }}>去面试</Link>
        </div>
      </div>

      {/* 快捷入口 */}
      <div className="quickGrid">
        {QUICK.map(q => {
          const I = q.icon
          return (
            <Link key={q.to} to={q.to} className="quickCard">
              <span className="quickIcon"><I size={20} /></span>
              <div>
                <div className="quickLabel">{q.label}</div>
                <div className="quickDesc">{q.desc}</div>
              </div>
            </Link>
          )
        })}
      </div>

      {/* 推荐学习路径 */}
      <section>
        <h2 className="sectionTitle">推荐学习路径</h2>
        <ol className="pathList">
          {learningPath().map((c, i) => (
            <li key={c.id}>
              <Link to={`/knowledge/${c.id}`} className="pathItem">
                <span className="pathIdx">{i + 1}</span>
                <span>{c.title}</span>
                <span className="pathMeta">{c.difficulty} · {c.readTime}</span>
              </Link>
            </li>
          ))}
        </ol>
      </section>

      {/* 继续学习 */}
      {inProgress.length > 0 && (
        <section>
          <h2 className="sectionTitle">继续学习</h2>
          <div className="chapterGrid">
            {inProgress.map(c => (
              <Link key={c.id} to={`/knowledge/${c.id}`} className="chapterCard">
                <div className="chapterCardTitle">{c.title}</div>
                <div className="chapterCardMeta">{c.difficulty} · {c.readTime}</div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* 为你推荐 */}
      <section>
        <h2 className="sectionTitle">为你推荐</h2>
        <div className="chapterGrid">
          {chapters.map(c => (
            <Link key={c.id} to={`/knowledge/${c.id}`} className="chapterCard">
              <div className="chapterCardTitle">{c.title}</div>
              <div className="chapterCardMeta">{c.difficulty} · {c.readTime}</div>
              <div className="tagRow">
                {c.tags.map(t => <span key={t} className="tag">{t}</span>)}
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}
