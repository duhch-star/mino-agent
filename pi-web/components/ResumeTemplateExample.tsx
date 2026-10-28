"use client";
import { useState } from 'react';
import { useResumeTemplates, templateCaption, templateDraft } from './resume-template-catalog';
import './resume-template-example.css';
export function ResumeTemplateExample({ onChooseTask }: { onChooseTask: (prompt: string) => void }) {
 const {items,error,retry}=useResumeTemplates();const [selected,setSelected]=useState('classic');
 const template=items.find(item=>item.id===selected)||items[0];
 return <section className="resume-template-example" aria-labelledby="resume-example-title">
 <header><div><h2 id="resume-example-title">浏览 LaTeX 简历模板</h2><p>清晰整页参考图 · 仅浏览不保存；两款作者原版及三款合成示例适配版。</p></div><label>示例模板 <select aria-label="选择开源简历示例" value={template?.id||selected} onChange={e=>setSelected(e.target.value)}>{items.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label></header>
 {error?<p role="alert">{error} <button onClick={retry}>重试加载</button></p>:!template?<p role="status">正在读取模板…</p>:<>
 <p className="resume-template-example-note">{templateCaption(template)}。仅供版式参考，作者或合成示例的学校、公司和成果不会作为你的经历保存。</p>
 <a href={`/examples/${template.id}.png`} target="_blank" rel="noreferrer" title="在新窗口查看清晰大图"><img key={template.id} alt={`${template.name} · ${templateCaption(template)}第一页`} src={`/examples/${template.id}.png`} style={{display:'block',width:'100%',height:'auto',background:'white'}} /></a>
 <footer><div><a href={template.originalPdfUrl} target="_blank" rel="noreferrer">打开完整示例 PDF</a>{template.sourceFileUrl&&<a href={template.sourceFileUrl} target="_blank" rel="noreferrer">模板上游源码</a>}<a href={template.licenseUrl} target="_blank" rel="noreferrer">{template.license} 许可</a></div><button type="button" onClick={()=>onChooseTask(templateDraft(template))}>使用此模板</button></footer>
 <p className="resume-template-example-note">只填入草稿，确认发送后再操作；保持当前正文。{template.fontInfo}</p></>}
 </section>;
}
