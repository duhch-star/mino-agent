import './ResumeOriginalPdf.css'

import { originalPdfUrl } from './resume-preview.js'
export { hasResumeContent, originalPdfUrl } from './resume-preview.js'

// Never import upstream sample fields into the user's editable resume.

export default function ResumeOriginalPdf({ template }) {
  const url = originalPdfUrl(template)
  return <section className="resumeOriginalPdf" aria-label="上游作者原版 PDF 示例">
    <p className="resumeOriginalPdfNote"><strong>上游作者原版 PDF 示例 · 非我的简历</strong><br/>完整原版编译 PDF，含作者个人信息，仅供查看版式；不会导入、保存或作为你的履历。填写真实经历后，请生成当前版本 PDF 查看实际排版。</p>
    {url ? <><a href={url} target="_blank" rel="noreferrer">在新窗口查看完整原版 PDF（嵌入预览不可用时使用）</a><iframe key={url} className="resumeOriginalPdfFrame" title={`${template?.name || template?.title || '所选模板'} · 上游作者完整原版 PDF 示例`} src={url}/></> : <p role="status">{template ? '此模板暂未提供原版 PDF，请查看模板来源链接。' : '正在读取所选模板的原版 PDF…'}</p>}
  </section>
}
