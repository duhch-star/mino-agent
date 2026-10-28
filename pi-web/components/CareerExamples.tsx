"use client";
import { useState } from 'react';
import './career-examples.css';

const EXAMPLES = [
  { id: 'classic', title: '经典单栏', description: '经历优先，结构清晰', source: 'sb2nov/resume' },
  { id: 'sidebar', title: '双栏布局', description: '信息分区，一页呈现', source: 'deedy/Deedy-Resume' },
] as const;

export function CareerExamples({ onChooseTask, onConfigure }: { onChooseTask?: (prompt: string) => void; onConfigure?: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [selected, setSelected] = useState(0);
  const example = EXAMPLES[selected];
  return <section className="career-examples" aria-labelledby="career-examples-title">
    <header><div><p className="career-examples-eyebrow">LATEX → PDF</p><h2 id="career-examples-title">从一份好简历，看见下一步</h2><p>原版编译结果展示 · 示例经历不属于你，也不会写入你的资料。</p></div><button type="button" aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>{expanded ? '收起案例' : '查看简历案例'} <span aria-hidden="true">↗</span></button></header>
    {expanded && <div className="career-examples-detail"><div className="career-examples-preview"><img src={`/examples/${example.id}.png`} alt={`${example.title}作者原版 LaTeX 编译 PDF 第一页，完整页面预览`} width={765} height={990} loading="lazy" /></div><div className="career-examples-copy"><div className="career-examples-tabs" aria-label="案例版式">{EXAMPLES.map((item, index) => <button type="button" key={item.id} aria-pressed={selected === index} onClick={() => setSelected(index)}>{item.title}</button>)}</div><h3>{example.title}</h3><p>{example.description}。左图直接从上游原版 PDF 渲染，不依赖浏览器内嵌 PDF 插件。</p><ol><li>选择版式，提供你的真实经历</li><li>在对话中确认内容与修改</li><li>使用 LaTeX 编译并导出 PDF</li></ol><p className="career-examples-note">来源：{example.source}。查看完整 PDF、源文件和许可需要登录后连接工作区。生成自己的 PDF 需配置 XeLaTeX。</p>{onChooseTask && <div className="career-examples-links"><a href={`/api/minos/resume-templates?template=${example.id}&resource=original.pdf`} target="_blank" rel="noreferrer">完整 PDF</a><a href={`/api/minos/resume-templates?template=${example.id}&resource=license`} target="_blank" rel="noreferrer">模板许可</a></div>}<button className="career-examples-start" type="button" onClick={() => onChooseTask ? onChooseTask(`我想参考 ${example.id} 的${example.title} LaTeX 简历版式。请先了解我的真实背景和目标岗位；读取已有简历后再决定是否用 resume_set_template 切换，保留已有正文。不要导入示例作者的姓名、学校、公司或成果，不要自动保存任何示例经历。`) : onConfigure?.()}>{onChooseTask ? '按这个版式开始' : '配置模型后开始'}</button><small>{onChooseTask ? '只填入草稿，不会自动发送或创建简历。' : '先完成模型配置，再用自己的经历建立简历。'}</small></div></div>}
  </section>;
}
