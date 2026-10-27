import { useEffect, useRef, useState } from 'react'
import { fetchResumeTemplates, editResumeByChat, fetchResumeSource, compileResumePdf, downloadResumeBundle } from '../api.js'
import ResumeTemplateGallery from '../components/ResumeTemplateGallery.jsx'
import ResumeOriginalPdf, { hasResumeContent } from '../components/ResumeOriginalPdf.jsx'
import '../styles/resume.css'

const EMPTY = { name: '', contact: '', summary: '', sections: ['教育经历', '项目经历', '技能'].map(title => ({ title, items: [], entries: [], column: 'auto' })) }
const EXAMPLE = {
  name: '示例姓名（请替换）', contact: 'your-name@example.com · 个人主页（请替换）',
  summary: '仅用于演示模板结构，不代表任何真实个人、学校、公司或已完成的成果；请替换为本人真实信息。',
  sections: [
    { title: '教育经历', column: 'left', items: [], entries: [{ heading: '学校名称（待填写）', subtitle: '专业 / 学位（待填写）', location: '城市（待填写）', dates: '入学年月 — 毕业年月（待填写）', items: ['相关课程：请填写实际修读的课程。'] }] },
    { title: '项目经历', column: 'right', items: [], entries: [{ heading: '个人练习项目（结构示例）', subtitle: '项目角色（待填写）', location: '个人学习 / 非公司经历', dates: '起止年月（待填写）', items: ['项目目标：请填写本人真实完成的功能。', '实现与验证：请填写实际使用的技术和验证方法，不添加未经证实的数据。'] }] },
    { title: '技能', column: 'left', items: ['编程语言：请填写本人实际掌握的语言。', '开发工具：请填写本人实际使用的工具。'], entries: [] },
  ],
}
const serialize = r => JSON.stringify(r, null, 2)
function fields(r) {
  return [['姓名', r.name], ['联系方式', r.contact], ['简介', r.summary], ...r.sections.flatMap((s, i) => {
    const prefix = `章节 ${i + 1}`
    return [[`${prefix} · 标题`, s.title], [`${prefix} · 分栏`, s.column ?? 'auto'], [`${prefix} · 条目`, (s.items ?? []).join('\n')],
      ...(s.entries ?? []).flatMap((entry, j) => ['heading', 'subtitle', 'location', 'dates', 'items'].map(key => [
        `${prefix} · 履历 ${j + 1} · ${{ heading: '标题', subtitle: '副标题', location: '地点', dates: '日期', items: '内容' }[key]}`,
        key === 'items' ? (entry.items ?? []).join('\n') : entry[key] ?? '',
      ]))]
  })]
}
function changes(a, b) {
  const before = new Map(fields(a)), after = new Map(fields(b))
  return [...new Set([...before.keys(), ...after.keys()])].filter(k => before.get(k) !== after.get(k)).map(k => ({ field: k, before: before.get(k) || '（空）', after: after.get(k) || '（删除）' }))
}
function validateResume(d) {
  const object = v => v !== null && typeof v === 'object' && !Array.isArray(v)
  const strings = v => Array.isArray(v) && v.every(i => typeof i === 'string')
  if (!object(d) || ['name', 'contact', 'summary'].some(k => typeof d[k] !== 'string') || !Array.isArray(d.sections)) throw Error('请保持 name/contact/summary 为文字，sections 为章节数组')
  d.sections.forEach((s, i) => {
    if (!object(s) || typeof s.title !== 'string' || !strings(s.items)) throw Error(`章节 ${i + 1}：title 必须是文字，items 必须是文字数组`)
    if (s.column !== undefined && !['auto', 'left', 'right'].includes(s.column)) throw Error(`章节 ${i + 1}：column 仅支持 auto / left / right`)
    if (s.entries !== undefined && (!Array.isArray(s.entries) || s.entries.some(e => !object(e) || ['heading', 'subtitle', 'location', 'dates'].some(k => e[k] !== undefined && typeof e[k] !== 'string') || (e.items !== undefined && !strings(e.items))))) throw Error(`章节 ${i + 1}：entries 必须是履历数组，heading/subtitle/location/dates 为文字，items 为文字数组`)
  })
  return d // 不重建对象：保留 entries、column 及原始数据，兼容旧版省略新增字段的 JSON。
}
function download(data, filename, type) { const u = URL.createObjectURL(data instanceof Blob ? data : new Blob([data], { type })); const a = document.createElement('a'); a.href = u; a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(u), 1000) }

export default function ResumeStudio() {
  const [resume, setResume] = useState(EMPTY), [template, setTemplate] = useState('classic')
  const [templates, setTemplates] = useState([]), [compiler, setCompiler] = useState(false)
  const [instruction, setInstruction] = useState(''), [chat, setChat] = useState([])
  const [proposal, setProposal] = useState(null), [previous, setPrevious] = useState(null)
  const [busy, setBusy] = useState(''), [error, setError] = useState(''), [source, setSource] = useState('')
  const [pdf, setPdf] = useState(''), [warnings, setWarnings] = useState(0), [json, setJson] = useState(serialize(EMPTY))
  const [localSave, setLocalSave] = useState(false)
  const pdfRef = useRef('')
  useEffect(() => { fetchResumeTemplates().then(d => { setTemplates(d.items); setCompiler(d.compilerAvailable) }).catch(e => setError(e.message))
    return () => { if (pdfRef.current) URL.revokeObjectURL(pdfRef.current) }
  }, [])
  useEffect(() => { setSource(''); setWarnings(0); if (pdfRef.current) URL.revokeObjectURL(pdfRef.current); pdfRef.current = ''; setPdf(''); setJson(serialize(resume)); if (localSave) localStorage.setItem('mino-resume-draft', serialize(resume)) }, [resume, template, localSave])
  const commit = next => { validateResume(next); setPrevious(resume); setResume(next); setProposal(null); setError('') }
  const edit = async () => {
    if (!instruction.trim() || busy) return
    const text = instruction.trim(); setBusy('edit'); setError(''); setChat(c => [...c, { role: 'user', text }]); setInstruction('')
    try { const result = await editResumeByChat(resume, text); validateResume(result.resume); setProposal({ ...result, base: serialize(resume) }); setChat(c => [...c, { role: 'assistant', text: result.explanation }]) }
    catch (e) { setError(e.message) } finally { setBusy('') }
  }
  const compile = async () => {
    setBusy('compile'); setError('')
    try { const { blob, warnings } = await compileResumePdf(resume, template); if (pdfRef.current) URL.revokeObjectURL(pdfRef.current); pdfRef.current = URL.createObjectURL(blob); setPdf(pdfRef.current); setWarnings(warnings) }
    catch (e) { setError(e.message) } finally { setBusy('') }
  }
  const tex = async () => { setBusy('source'); setError(''); try { const d = await fetchResumeSource(resume, template); setSource(d.source); download(d.source, 'resume.tex', 'text/plain;charset=utf-8') } catch(e) { setError(e.message) } finally { setBusy('') } }
  const bundle = async () => { setBusy('bundle'); setError(''); try { download(await downloadResumeBundle(resume, template), `resume-${template}-source.zip`) } catch(e) { setError(e.message) } finally { setBusy('') } }
  const applyJson = () => { try { commit(validateResume(JSON.parse(json))) } catch(e) { setError(e.message) } }
  const loadExample = () => {
    const hasContent = serialize(resume) !== serialize(EMPTY)
    if ((hasContent || json !== serialize(resume)) && !window.confirm('加载示例将覆盖当前简历及未应用的 JSON 编辑。示例不代表真实履历，是否继续？')) return
    commit(JSON.parse(serialize(EXAMPLE)))
  }
  const selectedTemplate = templates.find(item => item.id === template)
  const showOriginal = !pdf && !hasResumeContent(resume)
  return <div className="page scrollable resumeStudio">
    <header className="pageHeader"><h1>LaTeX 简历工作台</h1><p className="pageSub">对话修改 · 差异确认 · 原模板 PDF / LaTeX 源码导出</p></header>
    <p className="formHint">不会自动编造经历或成果。对话内容会发送至已配置的大模型；PDF 在本地后端编译。默认不持久保存个人简历。</p>
    {error && <p className="loginError" role="alert">{error}</p>}
    <ResumeTemplateGallery templates={templates} value={template} onChange={setTemplate} disabled={!!busy}/>
    <header className="resumeContentHeader"><h2>我的简历内容</h2><p className="formHint">下方为你自己的简历编辑与内容预览，与上方含作者信息的上游原版示例相互独立。</p></header>
    <div className="resumeColumns"><section className="resumePanel"><h2>通过对话修改</h2><div className="resumeChat">{!chat.length && <p className="formHint">可粘贴已有简历并说“请按以下内容建立简历”；也可说“把项目经历改得更简洁，不增加数据”“将技能移到教育经历前面”。</p>}{chat.map((m,i) => <div key={i} className={`resumeBubble ${m.role}`}><b>{m.role === 'user' ? '你' : '简历助手'}</b><p>{m.text}</p></div>)}</div>
      <textarea aria-label="简历修改要求" value={instruction} maxLength={6000} onChange={e => setInstruction(e.target.value)} placeholder="粘贴真实经历，或描述希望修改的内容…" disabled={!!busy || !!proposal} rows={5}/>
      <div className="btnRow"><button className="btn primary sm" onClick={edit} disabled={!!busy || !instruction.trim() || !!proposal}>{busy === 'edit' ? '生成修改建议…' : '发送修改要求'}</button><button className="btn ghost sm" onClick={() => { setInstruction(''); setChat([]) }} disabled={!!busy}>清空对话</button></div>
      {proposal && <div className="resumeProposal"><h3>待确认修改</h3><p>{proposal.explanation}</p>{proposal.questions?.map((q,i) => <p key={i} className="formHint">需补充：{q}</p>)}{changes(resume, proposal.resume).map((d,i) => <div className="resumeDiff" key={i}><b>{d.field}</b><del>{d.before}</del><ins>{d.after}</ins></div>)}<div className="btnRow"><button className="btn primary sm" onClick={() => { if (serialize(resume) !== proposal.base) { setError('原简历已更改，请重新生成建议'); return } commit(proposal.resume) }}>确认应用</button><button className="btn ghost sm" onClick={() => setProposal(null)}>放弃修改</button></div></div>}
      <details><summary>直接编辑结构化内容 / 导入 JSON</summary><p className="formHint">章节支持 items 和 entries 履历数组；履历支持 heading、subtitle、location、dates、items。column 可选 auto / left / right（用于双栏 PDF）。旧 JSON 可省略 entries / column。</p><textarea aria-label="简历JSON" rows={14} value={json} onChange={e => setJson(e.target.value)} disabled={!!busy || !!proposal}/><button className="btn outline sm" onClick={applyJson} disabled={!!busy || !!proposal}>应用手动编辑</button></details>
      <div className="btnRow"><button className="btn outline sm" onClick={loadExample} disabled={!!busy || !!proposal}>加载结构示例（非真实履历）</button><button className="btn ghost sm" disabled={!previous || !!busy || !!proposal} onClick={() => { setResume(previous); setPrevious(null) }}>撤销上次应用</button><button className="btn ghost sm" onClick={() => download(serialize(resume), 'resume.json','application/json')} disabled={!!busy}>备份 JSON</button></div>
      <label className="formHint"><input type="checkbox" checked={localSave} onChange={e => { setLocalSave(e.target.checked); if (!e.target.checked) localStorage.removeItem('mino-resume-draft') }}/>允许保存草稿到本机浏览器</label><button className="btn ghost sm" disabled={!!busy || !!proposal} onClick={() => { try { const s = localStorage.getItem('mino-resume-draft'); if(s) { setJson(s); setError('草稿已载入编辑框，请展开结构化编辑检查后应用。') } else setError('没有本地草稿') } catch { setError('无法读取草稿') } }}>载入本机草稿</button>
    </section><section className="resumePanel"><h2>{showOriginal ? '所选模板 · 完整原版 PDF 示例' : pdf ? '当前已确认版本 · 实际 PDF' : '当前已确认版本 · 内容预览'}</h2>{pdf ? <iframe className="resumePdf" title="LaTeX PDF实际预览" src={pdf}/> : showOriginal ? <ResumeOriginalPdf template={selectedTemplate}/> : <><div className="resumePaper"><h1>{resume.name || '你的姓名'}</h1><p>{resume.contact || '联系方式'}</p>{resume.summary && <p>{resume.summary}</p>}{resume.sections.map((s,i) => <section key={i}><h3>{s.title}</h3><small>PDF 分栏：{{ auto: '自动', left: '左栏', right: '右栏' }[s.column ?? 'auto']}</small>{s.items.length > 0 && <ul>{s.items.map((item,j) => <li key={j}>{item}</li>)}</ul>}{(s.entries ?? []).map((entry,j) => <div key={j}><h4>{entry.heading}</h4>{entry.subtitle && <p>{entry.subtitle}</p>}{(entry.location || entry.dates) && <p>{[entry.location, entry.dates].filter(Boolean).join(' · ')}</p>}{entry.items?.length > 0 && <ul>{entry.items.map((item,k) => <li key={k}>{item}</li>)}</ul>}</div>)}</section>)}</div><p className="formHint">上方只展示内容及分栏设置，不模拟模板版式；PDF 保留原模板排版，请生成 PDF 检查实际分页和溢出。单栏模板不使用左右分栏设置。</p></>}
      <div className="btnRow"><button className="btn primary sm" disabled={!!busy || !compiler} onClick={compile}>{busy === 'compile' ? '编译中…' : '生成 PDF'}</button><button className="btn outline sm" disabled={!!busy} onClick={tex}>导出单个 .tex</button><button className="btn outline sm" disabled={!!busy} onClick={bundle}>{busy === 'bundle' ? '打包中…' : '下载完整源码包（含字体/许可）'}</button>{pdf && <a className="btn outline sm" href={pdf} download="resume.pdf">下载 PDF</a>}</div>
      {template === 'sidebar' && <p className="formHint">Deedy 单个 .tex 不含字体、类文件等依赖，不能独立还原排版；建议下载完整 ZIP 源码包（含字体与许可）。</p>}
      {!compiler && <p className="formHint">后端暂未提供可用的 XeLaTeX / Tectonic 编译器，可先下载完整源码包，在配置相应编译器的环境中编译。</p>}{warnings > 0 && <p role="alert" className="formHint">检测到排版溢出，请检查 PDF，缩短内容或换用单栏模板。</p>}{source && <details><summary>LaTeX 源码（只读）</summary><pre className="resumeSource">{source}</pre></details>}
    </section></div>
  </div>
}
