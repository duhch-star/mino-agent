"use client";
import { useEffect, useState } from 'react';
export type ResumeTemplate = { id: string; name: string; originalPdfUrl: string; sourceFileUrl?: string; licenseUrl: string; license?: string; fontInfo?: string; description?: string; exampleKind?: string };
export function templateIsAdapted(template: Pick<ResumeTemplate, 'id'>) { return !['classic', 'sidebar'].includes(template.id); }
export function templateCaption(template: Pick<ResumeTemplate, 'id'>) { return templateIsAdapted(template) ? '合成示例适配版 · 非上游原始 PDF' : '作者原版 PDF 示例'; }
export function templateDraft(template: ResumeTemplate) { return `我想使用 ${template.id}（${template.name}）LaTeX 简历模板。请先读取当前简历并展示模板切换说明，等我确认后才调用 resume_set_template；仅切换版式，保持当前正文及未涉及字段。不要导入示例作者或合成示例的姓名、学校、公司和成果，不要自动保存任何示例经历。`; }
export function useResumeTemplates() {
 const [items,setItems]=useState<ResumeTemplate[]>([]);const [error,setError]=useState('');const [attempt,setAttempt]=useState(0);
 useEffect(()=>{const controller=new AbortController();setError('');fetch('/api/minos/resume-templates',{signal:controller.signal,cache:'no-store'}).then(async r=>{const data=await r.json();if(!r.ok||!data.items?.length)throw Error(data.error||'未找到模板');if(!controller.signal.aborted)setItems(data.items);}).catch(e=>{if(!controller.signal.aborted)setError(e.message);});return ()=>controller.abort();},[attempt]);
 return {items,error,retry:()=>setAttempt(v=>v+1)};
}
