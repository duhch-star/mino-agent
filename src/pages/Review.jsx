import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store.js'
import { IconCheck, IconClose } from '../components/Icons.jsx'

// 待审核章节草稿（演示，正式版来自后端「AI 章节生成流水线」的草稿队列）
const DRAFTS = [
  { id: 'd1', title: '群面技巧', tags: ['面试', '群面'], author: 'AI 助手', updated: '2026-10-16' },
  { id: 'd2', title: '实习转正指南', tags: ['求职', '实习'], author: 'AI 助手', updated: '2026-10-15' },
  { id: 'd3', title: '三方协议与毁约风险', tags: ['签约', '法律'], author: 'AI 助手', updated: '2026-10-14' },
]

export default function Review() {
  const user = useAuthStore(s => s.user)
  const navigate = useNavigate()
  const [drafts, setDrafts] = useState(DRAFTS.map(d => ({ ...d, status: 'pending' })))

  if (!user || user.role !== 'admin') {
    return (
      <div className="page scrollable">
        <p className="empty">此功能需要管理员权限</p>
        <button className="btn primary" onClick={() => navigate('/login')}>去登录</button>
      </div>
    )
  }

  const act = (id, status) => setDrafts(ds => ds.map(d => d.id === id ? { ...d, status } : d))

  return (
    <div className="page scrollable">
      <header className="pageHeader">
        <h1>内容审核</h1>
        <p className="pageSub">审核 AI 生成的章节草稿，通过后入库发布（对应产品方案的「人工审核」环节）</p>
      </header>

      <div className="reviewList">
        {drafts.map(d => (
          <div key={d.id} className="reviewItem">
            <div className="reviewMain">
              <div className="reviewTitle">{d.title}</div>
              <div className="reviewMeta">{d.author} · {d.updated}</div>
              <div className="tagRow">
                {d.tags.map(t => <span key={t} className="tag">{t}</span>)}
              </div>
            </div>
            <div className="reviewActions">
              {d.status === 'pending' ? (
                <>
                  <button className="btn outline sm" onClick={() => act(d.id, 'rejected')}><IconClose size={14} />驳回</button>
                  <button className="btn primary sm" onClick={() => act(d.id, 'approved')}><IconCheck size={14} />通过</button>
                </>
              ) : (
                <span className={`reviewStatus ${d.status}`}>
                  {d.status === 'approved' ? '已通过' : '已驳回'}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
