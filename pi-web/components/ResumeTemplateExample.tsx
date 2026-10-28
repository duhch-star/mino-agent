"use client";
import { useEffect, useState } from 'react';
import './resume-template-example.css';

type Template = { id: string; name: string; originalPdfUrl: string; sourceFileUrl: string; licenseUrl: string; license: string; fontInfo: string };
export function ResumeTemplateExample({ onChooseTask }: { onChooseTask: (prompt: string) => void }) {
  const [items, setItems] = useState<Template[]>([]);
  const [selected, setSelected] = useState('classic');
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let alive = true;
    setError('');
    fetch('/api/minos/resume-templates').then(async response => {
      const data = await response.json();
      if (!response.ok || !data.items?.length) throw new Error(data.error || '未找到开源模板');
      if (alive) setItems(data.items);
    }).catch(e => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, [attempt]);
  const template = items.find(item => item.id === selected) || items[0];
  return <section className="resume-template-example" aria-labelledby="resume-example-title">
    <header><div><h2 id="resume-example-title">从完整的开源简历模板开始</h2><p>下方是作者原版 LaTeX PDF 的第一页图片；可下载完整 PDF，不依赖浏览器 PDF 插件。</p></div>
      <label>示例模板 <select aria-label="选择开源简历示例" value={template?.id || selected} onChange={e => setSelected(e.target.value)}>{items.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
    </header>
    {error ? <p role="alert">{error} <button onClick={() => setAttempt(value => value + 1)}>重试加载</button></p> : !template ? <p role="status">正在读取原版示例…</p> : <>
      <p className="resume-template-example-note">作者示例 · 仅供版式参考，作者的学校、公司和成果不会作为你的经历保存。填写本人信息后沿用模板的类文件、字体和排版命令编译。</p>
      <img key={template.id} alt={`${template.name} · 原版 PDF 第一页`} src={`/examples/${template.id === 'sidebar' ? 'sidebar' : 'classic'}.png`} style={{ display: 'block', width: '100%', height: 'auto', background: 'white' }} />
      <footer><div><a href={template.originalPdfUrl} target="_blank" rel="noreferrer">打开完整 PDF</a><a href={template.sourceFileUrl} target="_blank" rel="noreferrer">上游固定版本源码</a><a href={template.licenseUrl} target="_blank" rel="noreferrer">{template.license} 许可</a></div>
        <button type="button" onClick={() => onChooseTask(`我想使用 ${template.id}（${template.name}）开源 LaTeX 模板建立自己的简历。请先读取当前简历；如果需要切换模板，使用 resume_set_template 保留已有正文。请先询问我的真实信息，后续只修改对应内容，保留未涉及的字段和模板排版，不导入作者示例经历，不重新设计字体或图标。`)}>用此模板填写我的信息</button>
      </footer><p className="resume-template-example-note">{template.fontInfo} 当前两套上游模板没有额外图标包；不额外仿制或替换图标。完整页面请点击“打开完整 PDF”查看或下载。</p>
    </>}
  </section>;
}
