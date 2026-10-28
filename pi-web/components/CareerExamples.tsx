"use client";
import { useState } from 'react';
import { useResumeTemplates, templateCaption, templateDraft } from './resume-template-catalog';
import './career-examples.css';
export function CareerExamples({ onChooseTask, onConfigure }: { onChooseTask?: (prompt: string) => void; onConfigure?: () => void }) {
 const [expanded,setExpanded]=useState(false);
 return <section className="career-examples" aria-labelledby="career-examples-title"><header><div><p className="career-examples-eyebrow">LATEX → PDF</p><h2 id="career-examples-title">从一份好简历，看见下一步</h2><p>五款版式参考 · 作者与合成示例经历不属于你，也不会写入你的资料。</p></div><button type="button" aria-expanded={expanded} onClick={()=>setExpanded(v=>!v)}>{expanded?'收起案例':'查看简历案例'} <span aria-hidden="true">↗</span></button></header>{expanded&&<ExampleGallery onChooseTask={onChooseTask} onConfigure={onConfigure}/>}</section>;
}
function ExampleGallery({onChooseTask,onConfigure}:{onChooseTask?: (prompt:string)=>void;onConfigure?:()=>void}) {
 const {items,error,retry}=useResumeTemplates();const [selected,setSelected]=useState('classic');const example=items.find(item=>item.id===selected)||items[0];
 if(error)return <p role="alert">{error} <button type="button" onClick={retry}>重试加载</button></p>;
 if(!example)return <p role="status">正在读取模板图库…</p>;
 return <div className="career-examples-detail"><div className="career-examples-preview"><a href={`/examples/${example.id}.png`} target="_blank" rel="noreferrer" title="打开清晰整页大图"><img src={`/examples/${example.id}.png`} alt={`${example.name} · ${templateCaption(example)}，完整页面预览`} width={765} height={990} loading="lazy" /></a></div><div className="career-examples-copy"><div className="career-examples-tabs" aria-label="案例版式">{items.map(item=><button type="button" key={item.id} aria-pressed={example.id===item.id} onClick={()=>setSelected(item.id)}>{item.name}</button>)}</div><h3>{example.name}</h3><p>{templateCaption(example)}。点击图片可查看清晰大图，不依赖内嵌 PDF 插件。</p><ol><li>选择版式，提供真实经历</li><li>在对话中确认修改，保留已有正文</li><li>编译并导出自己的 PDF</li></ol><p className="career-examples-note">仅供参考，不导入示例经历。Windows 安装版内置离线 LaTeX；源码部署需配置编译器。</p><div className="career-examples-links"><a href={example.originalPdfUrl} target="_blank" rel="noreferrer">完整示例 PDF</a><a href={example.licenseUrl} target="_blank" rel="noreferrer">模板许可</a></div><button className="career-examples-start" type="button" onClick={()=>onChooseTask?onChooseTask(templateDraft(example)):onConfigure?.()}>{onChooseTask?'使用此模板':'配置模型后开始'}</button><small>{onChooseTask?'只填入草稿，不会自动发送或创建简历。':'先完成模型配置，再用自己的经历建立简历。'}</small></div></div>;
}
