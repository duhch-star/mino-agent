import { useEffect, useId, useRef, useState } from 'react'
import '../styles/resume-template-gallery.css'

// Metadata is rendered as text only. Never embed upstream README / HTML.
const text = value => typeof value === 'string' && value.trim() ? value : ''
const list = value => Array.isArray(value) ? value.filter(item => text(item)) : []
function safeUrl(value) {
  try {
    const url = new URL(value)
    return ['http:', 'https:'].includes(url.protocol) ? url.href : ''
  } catch { return '' }
}
function ExternalLink({ href, children }) {
  const url = safeUrl(href)
  return url ? <a href={url} target="_blank" rel="noreferrer">{children}</a> : null
}
function Info({ label, value }) {
  return <div className="rtg-info"><dt>{label}</dt><dd>{text(value) || '上游信息暂未提供'}</dd></div>
}
function Items({ title, items }) {
  const values = list(items)
  return <div className="rtg-detailBlock"><h4>{title}</h4>{values.length ? <ul>{values.map((item, i) => <li key={i}>{item}</li>)}</ul> : <p>上游信息暂未提供</p>}</div>
}
function PreviewImage({ template, large = false }) {
  const [failed, setFailed] = useState(false)
  const url = safeUrl(template.previewUrl)
  if (!url || failed) return <span className="rtg-imageFallback" role="status">原版预览图暂不可用，请使用下方原 PDF 或项目链接查看。</span>
  return <img className={large ? 'rtg-largeImage' : 'rtg-image'} src={url} alt={`${text(template.title) || text(template.name)} · 上游原版整页示例（含作者个人信息）`} loading={large ? 'eager' : 'lazy'} decoding="async" onError={() => setFailed(true)} />
}

export default function ResumeTemplateGallery({ templates = [], value, onChange, disabled = false }) {
  const [preview, setPreview] = useState(null)
  const dialogRef = useRef(null)
  const triggerRef = useRef(null)
  const titleId = useId()
  const noteId = useId()
  const dialogTitleId = useId()
  const dialogNoteId = useId()
  useEffect(() => {
    const dialog = dialogRef.current
    if (preview && dialog && !dialog.open) dialog.showModal()
  }, [preview])
  const closePreview = () => {
    if (dialogRef.current?.open) dialogRef.current.close()
  }
  const afterClose = () => {
    setPreview(null)
    if (triggerRef.current?.isConnected) triggerRef.current.focus()
  }
  return <section className="resumeTemplateGallery" aria-labelledby={titleId} aria-describedby={noteId}>
    <header className="rtg-header"><h2 id={titleId}>选择简历模板 · 上游原版预览</h2><p id={noteId}>上游原版示例，含作者个人信息，仅供版式展示，不导入我的简历。使用模板只切换排版，不加载作者履历；请在下方“我的简历内容”中填写自己的真实信息。</p></header>
    <div className="rtg-grid">
      {templates.map(t => {
        const selected = t.id === value
        const name = text(t.name) || text(t.title) || t.id
        return <article key={t.id} className={`rtg-card${selected ? ' is-selected' : ''}`}>
          <header className="rtg-cardHeader"><div><h3>{name}</h3>{text(t.title) && <p className="rtg-originalTitle" lang="en">{t.title}</p>}</div>{selected && <span className="rtg-selected">已选模板</span>}</header>
          <button type="button" className="rtg-previewButton" aria-label={`放大查看 ${name} 上游原版示例`} aria-haspopup="dialog" onClick={event => { triggerRef.current = event.currentTarget; setPreview(t) }}><PreviewImage key={`${t.id}:${t.previewUrl}`} template={t}/><span className="rtg-previewCaption">上游原版整页示例 · 点击放大</span></button>
          <p className="rtg-personalNote">含作者个人信息，仅供版式展示，不导入我的简历。</p>
          <div className="rtg-links"><ExternalLink href={t.originalPdfUrl}>查看上游原 PDF</ExternalLink><ExternalLink href={t.source}>上游项目</ExternalLink></div>
          <div className="rtg-cardBody">
            <p className="rtg-author">作者：{text(t.author) || '暂未提供'} {safeUrl(t.authorUrl) && <>· <ExternalLink href={t.authorUrl}>作者主页</ExternalLink></>}</p>
            <p className="rtg-overview">{text(t.overview) || text(t.description) || '上游说明暂未提供。'}</p>
            {list(t.tags).length > 0 && <ul className="rtg-tags" aria-label="模板标签">{list(t.tags).map((tag, i) => <li key={i}>{tag}</li>)}</ul>}
            <Items title="模板特点" items={t.features}/>
            <button type="button" className="rtg-useButton" disabled={disabled} aria-pressed={selected} onClick={() => onChange(t.id)}>使用此模板{selected ? '（当前已选）' : ''}</button>
            <p className="rtg-selectionNote">仅应用排版，保留我的简历内容。</p>
            <details className="rtg-details"><summary>模板详情、来源与许可</summary>
              <div className="rtg-detailBlock"><h4>完整上游介绍</h4><p>{text(t.overview) || text(t.description) || '上游说明暂未提供。'}</p>{text(t.description) && t.description !== t.overview && <p>{t.description}</p>}</div>
              <Items title="原版章节" items={t.sections}/>
              <dl><Info label="布局" value={t.layout}/><Info label="字体" value={t.fontInfo}/><Info label="编译方式" value={t.compilerInfo}/><Info label="本机适配范围" value={t.adaptation}/></dl>
              <Items title="限制与注意事项" items={t.limitations}/>
              <dl><Info label="许可" value={t.license}/><Info label="作者" value={t.author}/><Info label="固定上游 commit" value={t.upstream}/></dl>
              <p className="rtg-licenseNote">模板许可适用于其授权范围；不代表作者个人履历、联系方式或其他个人信息可复用。请勿将原版示例中的作者信息当作自己的简历内容。</p>
              <nav className="rtg-links" aria-label={`${name} 来源和许可链接`}><ExternalLink href={t.authorUrl}>作者主页</ExternalLink><ExternalLink href={t.source}>上游项目</ExternalLink><ExternalLink href={t.sourceFileUrl}>固定 commit 源码</ExternalLink><ExternalLink href={t.commitUrl}>查看 commit</ExternalLink><ExternalLink href={t.readmeUrl}>README</ExternalLink><ExternalLink href={t.licenseUrl}>许可全文</ExternalLink><ExternalLink href={t.originalPdfUrl}>上游原 PDF</ExternalLink></nav>
            </details>
          </div>
        </article>
      })}
    </div>
    {!templates.length && <p className="rtg-empty" role="status">暂无可展示的模板，请等待模板信息加载或检查后端连接。</p>}
    <dialog className="rtg-dialog" ref={dialogRef} aria-labelledby={dialogTitleId} aria-describedby={dialogNoteId} onClose={afterClose} onClick={event => { if (event.target === event.currentTarget) closePreview() }}>
      {preview && <div className="rtg-dialogContent"><header className="rtg-dialogHeader"><h2 id={dialogTitleId}>{text(preview.title) || text(preview.name)} · 上游原版预览</h2><button type="button" className="rtg-close" autoFocus onClick={closePreview} aria-label="关闭原版大图预览">关闭 ×</button></header><p id={dialogNoteId}>上游原版示例，含作者个人信息，仅供版式展示，不导入我的简历。可按 Escape 或点击背景关闭。</p><div className="rtg-links"><ExternalLink href={preview.originalPdfUrl}>在新窗口查看上游原 PDF</ExternalLink><ExternalLink href={preview.source}>上游项目</ExternalLink></div><div className="rtg-largePreview"><PreviewImage key={`${preview.id}:${preview.previewUrl}`} template={preview} large/></div></div>}
    </dialog>
  </section>
}
