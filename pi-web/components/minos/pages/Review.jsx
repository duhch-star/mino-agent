import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store.js'
import { fetchReviewDrafts, reviewDraft } from '../api.js'
import { IconCheck, IconClose } from '../components/Icons.jsx'

const STATUS_LABEL = { pending: '待审核', approved: '已通过', rejected: '已驳回', draft: '草稿', review: '待审核', reviewed: '已通过' }

export default function Review() {
  const user = useAuthStore(s => s.user)
  const navigate = useNavigate()
  const [drafts, setDrafts] = useState(null)
  const [error, setError] = useState('')
  const [acting, setActing] = useState(null)

  useEffect(() => {
    if (!user || user.role !== 'admin') return
    let alive = true
    fetchReviewDrafts()
      .then(data => alive && setDrafts((data.items || []).map(d => ({ ...d, status: d.status === 'published' ? 'approved' : d.status }))))
      .catch(err => alive && setError(err.message || '加载失败'))
    return () => { alive = false }
  }, [user])

  if (!user || user.role !== 'admin') {
    return (
      <div className="page scrollable">
        <p className="empty">此功能需要管理员权限</p>
        <button className="btn primary" onClick={() => navigate('/login')}>去登录</button>
      </div>
    )
  }

  const act = async (id, decision) => {
    setActing(id)
    setError('')
    try {
      const result = await reviewDraft(id, decision)
      setDrafts(ds => ds.map(d => d.id === id ? {
        ...d,
        status: decision === 'approved' ? 'reviewed' : 'rejected',
        decided: true,
      } : d))
      return result
    } catch (err) {
      setError(err.message || '操作失败')
    } finally {
      setActing(null)
    }
  }

  const pending = (drafts || []).filter(d => !['reviewed', 'approved', 'rejected'].includes(d.status) || !d.decided)

  return (
    <div className="page scrollable">
      <header className="pageHeader">
        <h1>内容审核</h1>
        <p className="pageSub">审核 AI 生成的章节草稿，通过后入库发布（对应产品方案的「人工审核」环节）</p>
      </header>

      {error && <p className="loginError">{error}</p>}

      <div className="reviewList">
        {drafts === null ? (
          <p className="formHint">加载中…</p>
        ) : pending.length === 0 ? (
          <p className="empty">暂无待审核草稿</p>
        ) : (
          pending.map(d => {
            const decided = d.decided || ['reviewed', 'approved', 'rejected'].includes(d.status)
            const label = d.status === 'reviewed' || d.status === 'approved'
              ? '已通过'
              : d.status === 'rejected' ? '已驳回' : STATUS_LABEL[d.status] || '待审核'
            return (
              <div key={d.id} className="reviewItem">
                <div className="reviewMain">
                  <div className="reviewTitle">{d.title}</div>
                  <div className="reviewMeta">{d.updated_at ? new Date(d.updated_at).toLocaleDateString() : ''} · {d.status}</div>
                  {d.summary && <div className="formHint">{d.summary}</div>}
                </div>
                <div className="reviewActions">
                  {!decided ? (
                    <>
                      <button className="btn outline sm" onClick={() => act(d.id, 'rejected')} disabled={acting === d.id}><IconClose size={14} />驳回</button>
                      <button className="btn primary sm" onClick={() => act(d.id, 'approved')} disabled={acting === d.id}><IconCheck size={14} />通过</button>
                    </>
                  ) : (
                    <span className={`reviewStatus ${d.status === 'rejected' ? 'rejected' : 'approved'}`}>
                      {label}
                    </span>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}