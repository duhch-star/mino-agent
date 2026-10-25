import { useEffect, useRef, useState } from 'react'
import { fetchResumeTemplates, editResumeByChat, fetchResumeSource, compileResumePdf } from '../api.js'
import '../styles/resume.css'

const EMPTY = { name: '', contact: '', summary: '', sections: [{ title: '教育经历', items: [] }, { title: '项目经历', items: [] }, { title: '技能', items: [] }] }
const serialize = r => JSON.stringify(r, null, 2)
function fields(r) { return [['姓名', r.name], ['联系方式', r.contact], ['简介', r.summary], ...r.sections.map((s, i) => [`${i + 1}. ${s.title}`, s.items.join('\n')])] }
function changes(a, b) {
  const before = new Map(fields(a)), after = new Map(fields(b))
  return [...new Set([...before.keys(), ...after.keys()])].filter(k => before.get(k) !== after.get(k)).map(k => ({ field: k, before: before.get(k) || '（空）', after: after.get(k) || '（删除）' }))
}
function download(text, filename, type) { const u = URL.createObjectURL(new Blob([text], { type })); const a = document.createElement('a'); a.href = u; a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(u), 1000) }

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
  useEffect(() => { setSource(''); if (pdfRef.current) URL.revokeObjectURL(pdfRef.current); pdfRef.current = ''; setPdf(''); setJson(serialize(resume)); if (localSave) localStorage.setItem('mino-resume-draft', serialize(resume)) }, [resume, template, localSave])
  const commit = next => { setPrevious(resume); setResume(next); setProposal(null) }
  const edit = async () => {
    if (!instruction.trim() || busy) return
    const text = instruction.trim(); setBusy('edit'); setError(''); setChat(c => [...c, { role: 'user', text }]); setInstruction('')
    try { const result = await editResumeByChat(resume, text); setProposal({ ...result, base: serialize(resume) }); setChat(c => [...c, { role: 'assistant', text: result.explanation }]) }
    catch (e) { setError(e.message) } finally { setBusy('') }
  }
  const compile = async () => {
    setBusy('compile'); setError('')
    try { const { blob, warnings } = await compileResumePdf(resume, template); if (pdfRef.current) URL.revokeObjectURL(pdfRef.current); pdfRef.current = URL.createObjectURL(blob); setPdf(pdfRef.current); setWarnings(warnings) }
    catch (e) { setError(e.message) } finally { setBusy('') }
  }
  const tex = async () => { setBusy('source'); setError(''); try { const d = await fetchResumeSource(resume, template); setSource(d.source); download(d.source, 'resume.tex', 'text/plain;charset=utf-8') } catch(e) { setError(e.message) } finally { setBusy('') } }
  const applyJson = () => { try { const d = JSON.parse(json); if (typeof d.name !== 'string' || typeof d.contact !== 'string' || typeof d.summary !== 'string' || !Array.isArray(d.sections) || d.sections.some(s => typeof s.title !== 'string' || !Array.isArray(s.items) || s.items.some(i => typeof i !== 'string'))) throw Error('请保持 name/contact/summary/sections 结构，items 必须是文字数组'); commit(d) } catch(e) { setError(e.message) } }
  return <div className="page scrollable resumeStudio">
    <header className="pageHeader"><h1>LaTeX 简历工作台</h1><p className="pageSub">对话修改 · 差异确认 · 中文排版 · PDF / LaTeX 导出</p></header>
    <p className="formHint">不会自动编造经历或成果。对话内容会发送至已配置的大模型；PDF 在本地后端编译。默认不持久保存个人简历。</p>
    {error && <p className="loginError" role="alert">{error}</p>}
    <div className="resumeTemplates">{templates.map(t => <button disabled={!!busy} className={`resumeTemplate ${template === t.id ? 'selected' : ''}`} key={t.id} onClick={() => setTemplate(t.id)}><b>{t.name}</b><span>{t.description}</span><small>{t.license} · 中文适配版</small></button>)}</div>
    {templates.find(t => t.id === template) && <p className="formHint">{templates.find(t => t.id === template).adaptation} · <a href={templates.find(t => t.id === template).source} target="_blank" rel="noreferrer">GitHub 来源</a></p>}
    <div className="resumeColumns"><section className="resumePanel"><h2>通过对话修改</h2><div className="resumeChat">{!chat.length && <p className="formHint">可粘贴已有简历并说“请按以下内容建立简历”；也可说“把项目经历改得更简洁，不增加数据”“将技能移到教育经历前面”。</p>}{chat.map((m,i) => <div key={i} className={`resumeBubble ${m.role}`}><b>{m.role === 'user' ? '你' : '简历助手'}</b><p>{m.text}</p></div>)}</div>
      <textarea aria-label="简历修改要求" value={instruction} maxLength={6000} onChange={e => setInstruction(e.target.value)} placeholder="粘贴真实经历，或描述希望修改的内容…" disabled={!!busy || !!proposal} rows={5}/>
      <div className="btnRow"><button className="btn primary sm" onClick={edit} disabled={!!busy || !instruction.trim() || !!proposal}>{busy === 'edit' ? '生成修改建议…' : '发送修改要求'}</button><button className="btn ghost sm" onClick={() => { setInstruction(''); setChat([]) }} disabled={!!busy}>清空对话</button></div>
      {proposal && <div className="resumeProposal"><h3>待确认修改</h3><p>{proposal.explanation}</p>{proposal.questions?.map((q,i) => <p key={i} className="formHint">需补充：{q}</p>)}{changes(resume, proposal.resume).map((d,i) => <div className="resumeDiff" key={i}><b>{d.field}</b><del>{d.before}</del><ins>{d.after}</ins></div>)}<div className="btnRow"><button className="btn primary sm" onClick={() => { if (serialize(resume) !== proposal.base) { setError('原简历已更改，请重新生成建议'); return } commit(proposal.resume) }}>确认应用</button><button className="btn ghost sm" onClick={() => setProposal(null)}>放弃修改</button></div></div>}
      <details><summary>直接编辑结构化内容 / 导入 JSON</summary><textarea aria-label="简历JSON" rows={14} value={json} onChange={e => setJson(e.target.value)} disabled={!!busy || !!proposal}/><button className="btn outline sm" onClick={applyJson} disabled={!!busy || !!proposal}>应用手动编辑</button></details>
      <div className="btnRow"><button className="btn ghost sm" disabled={!previous || !!busy || !!proposal} onClick={() => { setResume(previous); setPrevious(null) }}>撤销上次应用</button><button className="btn ghost sm" onClick={() => download(serialize(resume), 'resume.json','application/json')} disabled={!!busy}>备份 JSON</button></div>
      <label className="formHint"><input type="checkbox" checked={localSave} onChange={e => { setLocalSave(e.target.checked); if (!e.target.checked) localStorage.removeItem('mino-resume-draft') }}/>允许保存草稿到本机浏览器</label><button className="btn ghost sm" disabled={!!busy || !!proposal} onClick={() => { try { const s = localStorage.getItem('mino-resume-draft'); if(s) { setJson(s); setError('草稿已载入编辑框，请展开结构化编辑检查后应用。') } else setError('没有本地草稿') } catch { setError('无法读取草稿') } }}>载入本机草稿</button>
    </section><section className="resumePanel"><h2>当前已确认版本</h2><div className={`resumePaper ${template}`}><h1>{resume.name || '你的姓名'}</h1><p>{resume.contact || '联系方式'}</p>{resume.summary && <p>{resume.summary}</p>}{resume.sections.map((s,i) => <section key={i}><h3>{s.title}</h3><ul>{s.items.map((item,j) => <li key={j}>{item}</li>)}</ul></section>)}</div><p className="formHint">上方为内容预览，不是精确 LaTeX 排版；请生成 PDF 检查实际分页和溢出。</p>
      <div className="btnRow"><button className="btn primary sm" disabled={!!busy || !compiler} onClick={compile}>{busy === 'compile' ? '编译中…' : '生成 PDF'}</button><button className="btn outline sm" disabled={!!busy} onClick={tex}>导出 LaTeX</button>{pdf && <a className="btn outline sm" href={pdf} download="resume.pdf">下载 PDF</a>}</div>{!compiler && <p className="formHint">后端未检测到 XeLaTeX，可先导出源码。</p>}{warnings > 0 && <p role="alert" className="formHint">检测到排版溢出，请检查 PDF，缩短内容或换用单栏模板。</p>}{pdf && <iframe className="resumePdf" title="LaTeX PDF实际预览" src={pdf}/>} {source && <details><summary>LaTeX 源码（只读）</summary><pre className="resumeSource">{source}</pre></details>}
    </section></div>
  </div>
}
