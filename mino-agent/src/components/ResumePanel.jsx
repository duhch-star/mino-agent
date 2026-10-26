import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchResumeTemplates, fetchResumeDocument, saveResumeDocument, compileResumeDocument, fetchResumeDocumentPdf, fetchResumeSource, downloadResumeBundle, fetchResumeHistory, undoResumeDocument } from '../api.js'
import ResumeTemplateGallery from './ResumeTemplateGallery.jsx'
import '../styles/resume-workspace.css'
import '../styles/resume-history.css'

const EMPTY = { name: '', contact: '', summary: '', sections: [] }
const serialize = value => JSON.stringify(value, null, 2)
function toolOutput(call) {
  try { return typeof call.output === 'string' ? JSON.parse(call.output) : call.output } catch { return null }
}
function ChangeDetails({ item }) {
  return <details className="resumeChangeDetails"><summary>查看差异</summary>{item.changes.map((change, index) => <section key={index}><h4>{change.field}</h4><div className="resumeChangeComparison"><div><small>修改前</small><pre>{change.before || '（空）'}</pre></div><div><small>修改后</small><pre>{change.after || '（空）'}</pre></div></div></section>)}</details>
}
function ResumeContent({ resume }) {
  return <article className="resumeDocumentPaper"><h2>{resume.name || '你的姓名'}</h2><p>{resume.contact}</p>{resume.summary && <p>{resume.summary}</p>}{(resume.sections || []).map((section, index) => <section key={index}><h3>{section.title}</h3>{section.items?.length > 0 && <ul>{section.items.map((item, i) => <li key={i}>{item}</li>)}</ul>}{(section.entries || []).map((entry, i) => <div key={i}><h4>{entry.heading}</h4><p>{[entry.subtitle, entry.location, entry.dates].filter(Boolean).join(' · ')}</p>{entry.items?.length > 0 && <ul>{entry.items.map((item, j) => <li key={j}>{item}</li>)}</ul>}</div>)}</section>)}</article>
}

// 由 ChatApp 用 conversationId 作 key。异步响应还需检查 alive/请求序号及版本，避免旧 PDF 回灌。
export default function ResumePanel({ conversationId, messages, running, onClose }) {
  const [document, setDocument] = useState(null)
  const [templates, setTemplates] = useState([])
  const [tab, setTab] = useState('content')
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [json, setJson] = useState('')
  const [dirty, setDirty] = useState(false)
  const dirtyRef = useRef(false)
  const draftBase = useRef(null)
  const [draftConflict, setDraftConflict] = useState(false)
  const [history, setHistory] = useState({ items: [], canUndo: false })
  const [pdf, setPdf] = useState(null)
  const [warnings, setWarnings] = useState([])
  const [galleryOpen, setGalleryOpen] = useState(false)
  const galleryRef = useRef(null)
  const alive = useRef(true)
  const requestVersion = useRef(0)
  const documentRef = useRef(null)
  const pdfRef = useRef(null)
  const seenCompiles = useRef(new Set())
  const operation = useRef(0)
  const invalidatePdf = useCallback(() => {
    if (pdfRef.current) URL.revokeObjectURL(pdfRef.current.url)
    pdfRef.current = null
    setPdf(null)
    setWarnings([])
  }, [])
  const installDocument = useCallback(data => {
    const previous = documentRef.current
    if (!previous || previous.revision !== data.revision || previous.template !== data.template) {
      invalidatePdf()
      setHistory({ items: [], canUndo: false })
    }
    documentRef.current = data
    setDocument(data)
    if (!dirtyRef.current) {
      setJson(serialize(data.resume || EMPTY))
      draftBase.current = data.revision
      setDraftConflict(false)
    } else if (draftBase.current !== data.revision) {
      setDraftConflict(true)
    }
    return data
  }, [invalidatePdf])
  const refresh = useCallback(async () => {
    const version = ++requestVersion.current
    const data = await fetchResumeDocument(conversationId)
    if (!alive.current || version !== requestVersion.current) return null
    installDocument(data)
    const changes = await fetchResumeHistory(conversationId)
    if (!alive.current || version !== requestVersion.current) return null
    if (changes.revision === documentRef.current?.revision) setHistory(changes)
    return data
  }, [conversationId, installDocument])
  const loadPdf = useCallback(async result => {
    if (!result || !Number.isInteger(result.revision)) return
    const expected = documentRef.current
    if (!expected || expected.revision !== result.revision || (result.template && expected.template !== result.template)) return
    const blob = await fetchResumeDocumentPdf(conversationId, result.revision, result.pdfUrl)
    if (!alive.current || documentRef.current?.revision !== result.revision || documentRef.current?.template !== expected.template) return
    invalidatePdf()
    const next = { url: URL.createObjectURL(blob), revision: result.revision, template: expected.template }
    pdfRef.current = next
    setPdf(next)
    setWarnings(result.warnings || [])
    setTab('preview')
  }, [conversationId, invalidatePdf])
  useEffect(() => {
    alive.current = true
    refresh().catch(e => { if (alive.current) setError(e.message) })
    fetchResumeTemplates().then(data => { if (alive.current) setTemplates(data.items || []) }).catch(e => { if (alive.current) setError(e.message) })
    return () => { alive.current = false; requestVersion.current++; if (pdfRef.current) URL.revokeObjectURL(pdfRef.current.url) }
  }, [refresh])

  const calls = messages.flatMap(message => message.toolCalls || [])
  const completedCalls = calls.filter(call => call.name?.startsWith('resume_') && call.status === 'completed')
  const signature = serialize(completedCalls)
  // 工具终态和 done 回填均触发一次读取；只拉取 compile 工具已生成的 PDF，绝不自动再次编译。
  useEffect(() => {
    let cancelled = false
    const synchronize = async () => {
      const current = await refresh()
      if (!current || cancelled) return
      const compileCall = [...completedCalls].reverse().find(call => call.name === 'resume_compile' && toolOutput(call)?.revision === current.revision)
      if (compileCall && !seenCompiles.current.has(compileCall.id)) {
        seenCompiles.current.add(compileCall.id)
        try { await loadPdf(toolOutput(compileCall)) } catch (e) { seenCompiles.current.delete(compileCall.id); throw e }
      }
    }
    synchronize().catch(e => { if (alive.current && !cancelled) setError(e.message) })
    return () => { cancelled = true }
    // signature captures tool status/output, not streaming message text.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, running, refresh, loadPdf])
  useEffect(() => {
    if (galleryOpen && !galleryRef.current?.open) galleryRef.current?.showModal()
  }, [galleryOpen])

  const save = async (resume, template, manual = false) => {
    if (!documentRef.current || busy || running) return
    const token = ++operation.current
    if (manual && draftConflict) { setError('请先选择恢复到最新内容，或确认将保留的手稿应用到最新版本。'); return }
    const expectedRevision = manual ? draftBase.current : documentRef.current.revision
    setBusy('save'); setError('')
    try {
      await saveResumeDocument(conversationId, { resume, template, expectedRevision })
      if (!alive.current || token !== operation.current) return
      if (manual) { dirtyRef.current = false; setDirty(false) }
      invalidatePdf()
      await refresh()
    } catch (e) {
      if (alive.current) { setError(e.status === 409 ? '简历已被更新；未保存的手稿仍已保留，请对照最新内容后选择恢复方式。' : e.message); if (e.status === 409) await refresh().catch(() => {}) }
    } finally { if (alive.current && token === operation.current) setBusy('') }
  }
  const undo = async () => {
    if (!documentRef.current || busy || running || dirtyRef.current) return
    const token = ++operation.current
    setBusy('undo'); setError('')
    try {
      const data = await undoResumeDocument(conversationId, documentRef.current.revision)
      if (!alive.current || token !== operation.current) return
      requestVersion.current++
      installDocument(data)
      await refresh()
    } catch (e) {
      if (alive.current) { setError(e.status === 409 ? '简历或撤销记录已变化，已读取最新内容，请检查后重试。' : e.message); if (e.status === 409) await refresh().catch(() => {}) }
    } finally { if (alive.current && token === operation.current) setBusy('') }
  }
  const resetDraft = () => {
    dirtyRef.current = false; setDirty(false); setDraftConflict(false)
    draftBase.current = documentRef.current?.revision
    setJson(serialize(documentRef.current?.resume || EMPTY))
  }
  const compile = async () => {
    if (!documentRef.current?.exists || busy || running || dirtyRef.current) return
    const token = ++operation.current
    const revision = documentRef.current.revision
    setBusy('compile'); setError('')
    try {
      const result = await compileResumeDocument(conversationId)
      if (!alive.current || token !== operation.current) return
      const latest = await refresh()
      if (!latest || latest.revision !== result.revision || result.revision !== revision) { setError('简历版本已变化，请为最新版本重新生成 PDF。'); return }
      await loadPdf(result)
      if (alive.current) setTab('preview')
    } catch (e) { if (alive.current) setError(e.message) }
    finally { if (alive.current && token === operation.current) setBusy('') }
  }
  const exportJson = () => {
    if (!document?.exists) return
    const url = URL.createObjectURL(new Blob([serialize(document.resume)], { type: 'application/json;charset=utf-8' }))
    const anchor = window.document.createElement('a')
    anchor.href = url; anchor.download = 'resume.json'; anchor.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  const exportSource = async bundle => {
    const current = documentRef.current
    if (!current?.exists || busy) return
    setBusy('export'); setError('')
    try {
      const data = bundle ? await downloadResumeBundle(current.resume, current.template) : await fetchResumeSource(current.resume, current.template)
      if (!alive.current || documentRef.current?.revision !== current.revision || documentRef.current?.template !== current.template) return
      const blob = bundle ? data : new Blob([data.source], { type: 'text/plain;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const anchor = window.document.createElement('a')
      anchor.href = url
      anchor.download = bundle ? `resume-${current.template}-source.zip` : 'resume.tex'
      anchor.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (e) { if (alive.current) setError(e.message) }
    finally { if (alive.current) setBusy('') }
  }
  const resume = document?.resume || EMPTY
  const warningCount = Array.isArray(warnings) ? warnings.length : Number(warnings) || 0
  return <aside className="resumeWorkspacePanel" aria-label="当前会话简历">
    <header className="resumeWorkspaceHeader"><div><h2>我的简历</h2><small>{document ? `版本 ${document.revision} · ${templates.find(t => t.id === document.template)?.name || (document.template === 'sidebar' ? '侧栏双栏模板' : '经典单栏模板')}` : '读取会话文档中…'}</small></div><button className="btn ghost sm" onClick={onClose} aria-label="关闭简历栏">关闭 ×</button></header>
    <div className="resumeWorkspaceActions"><button className="btn outline sm" onClick={() => setGalleryOpen(true)}>选择模板</button><button className="btn primary sm" disabled={!document?.exists || !!busy || running || dirty} onClick={compile}>{busy === 'compile' ? '生成中…' : pdf ? '更新 PDF' : '生成 / 更新 PDF'}</button><a className={`btn outline sm${!pdf ? ' resumeDownloadDisabled' : ''}`} href={pdf?.url} download="resume.pdf" aria-disabled={!pdf} onClick={e => { if (!pdf) e.preventDefault() }}>下载 PDF</a></div>
    {document?.exists && <p className="resumePdfStatus" role="status">{busy === 'compile' ? '正在生成当前内容的 PDF…' : pdf ? 'PDF 已就绪，与当前内容一致。' : '内容已保存 · 待生成 PDF'}{dirty && ' 手稿尚未保存；请先保存或放弃手稿，再生成 PDF。'}</p>}
    {history.items.length > 0 && <section className="resumeRecentChange" aria-label="最近变更"><div className="resumeRecentChangeHeading"><strong>最近变更</strong><button className="btn outline sm" disabled={!history.canUndo || !!busy || running || dirty} onClick={undo}>{busy === 'undo' ? '撤销中…' : '撤销上次修改'}</button></div><p>{history.items[0].summary}</p><ChangeDetails item={history.items[0]}/></section>}
    <div className="resumeWorkspaceTabs" role="tablist" aria-label="简历视图">{[['content', '内容'], ['preview', 'PDF 预览']].map(([id, label]) => <button key={id} role="tab" id={`resume-tab-${id}`} aria-controls={`resume-view-${id}`} aria-selected={tab === id} onClick={() => setTab(id)}>{label}</button>)}</div>
    {error && <p className="resumeWorkspaceError" role="alert">{error}<button className="btn ghost sm" onClick={() => refresh().then(() => setError('')).catch(e => setError(e.message))}>重新读取</button></p>}
    <div className="resumeWorkspaceBody" role="tabpanel" id={`resume-view-${tab}`} aria-labelledby={`resume-tab-${tab}`}>
      {!document?.exists && <div className="resumeWorkspaceGuide"><h3>从你的真实经历开始</h3><p>在左侧同一个聊天输入框中，粘贴已有简历，或告诉我教育背景、项目经历、技能和目标岗位。我会直接更新本会话的简历，不会编造经历与成果。</p><p>例如：“请根据以下真实信息建立简历……”</p></div>}
      {tab === 'content' ? <>{document?.exists && <ResumeContent resume={resume}/>}<details className="resumeJsonEditor"><summary>高级：导出 TeX / ZIP / JSON</summary><p>单个 .tex 不包含字体、类文件等依赖。建议下载完整源码包（含字体与许可），保留原模板完整资源。</p><button className="btn outline sm" disabled={!document?.exists || !!busy || running} onClick={() => exportSource(false)}>导出 .tex</button> <button className="btn outline sm" disabled={!document?.exists || !!busy || running} onClick={() => exportSource(true)}>下载完整源码包</button> <button className="btn outline sm" disabled={!document?.exists || !!busy || running} onClick={exportJson}>下载 JSON 手稿</button></details><details className="resumeJsonEditor"><summary>高级：手动编辑 JSON{dirty ? '（未保存）' : ''}</summary><p>自动同步不会覆盖未保存的手稿。保存时检查编辑起始版本，避免覆盖聊天中的新修改。</p>{draftConflict && <div className="resumeDraftConflict" role="alert"><p>聊天或其他窗口已更新简历。你的手稿已保留，请先对照上方最新内容。</p><button className="btn outline sm" onClick={resetDraft}>放弃手稿，恢复最新内容</button><button className="btn outline sm" onClick={() => { draftBase.current = documentRef.current.revision; setDraftConflict(false) }}>已核对，保留手稿作为下一次修改</button></div>}<textarea aria-label="简历 JSON" rows={14} value={json} onChange={e => { setJson(e.target.value); dirtyRef.current = true; setDirty(true) }} disabled={!!busy || running}/><button className="btn outline sm" disabled={!document || !!busy || running || !dirty || draftConflict} onClick={() => { try { const next = JSON.parse(json); if (!next || typeof next !== 'object' || !Array.isArray(next.sections)) throw Error('请输入包含 sections 数组的简历对象'); save(next, document.template, true) } catch (e) { setError(e.message) } }}>保存手动修改</button>{dirty && !draftConflict && <button className="btn ghost sm" onClick={resetDraft}>放弃未保存修改</button>}</details><details className="resumeJsonEditor resumeHistory"><summary>高级：修改历史</summary><p>仅保留最近 20 次修改，不保存旧 PDF。连续撤销会依次恢复更早内容，不会来回切换；撤销本身也会记录为一次新修改。</p>{history.items.map(item => <section key={item.revision}><strong>版本 {item.revision}</strong><p>{item.summary}</p><ChangeDetails item={item}/></section>)}</details></> : <>{warningCount > 0 && <p role="status">有 {warningCount} 项排版提示，请检查分页和溢出。{Array.isArray(warnings) && warnings.map((w, i) => <span key={i}> {typeof w === 'string' ? w : serialize(w)}</span>)}</p>}{pdf && pdf.revision === document?.revision && pdf.template === document?.template ? <iframe className="resumeWorkspacePdf" title="当前版本简历 PDF" src={pdf.url}/> : <p className="resumeWorkspaceGuide">尚无当前版本 PDF。请点击“生成 PDF”，或在聊天中请助手编译。内容或模板更新后，旧 PDF 自动失效，不会自动重复编译。</p>}</>}
    </div>
    <dialog className="resumeGalleryDialog" ref={galleryRef} onClose={() => setGalleryOpen(false)} onClick={e => { if (e.target === e.currentTarget) galleryRef.current.close() }} aria-labelledby="resume-gallery-title"><header><h2 id="resume-gallery-title">模板画廊</h2><button className="btn outline sm" onClick={() => galleryRef.current.close()}>关闭 ×</button></header><ResumeTemplateGallery templates={templates} value={document?.template} disabled={!document || !!busy || running} onChange={template => save(resume, template)}/></dialog>
  </aside>
}
