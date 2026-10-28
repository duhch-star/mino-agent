"use client";
import { useEffect, useState } from 'react';
import './resume-preview-panel.css';
import { useResumeTemplates, templateCaption } from './resume-template-catalog';

type Preview = { exists: boolean; template: string; conversationId?: string; revision?: number; pdfReady: boolean; source?: string };
export function ResumePreviewPanel({ sessionId, refreshKey, requestedRevision }: { sessionId?: string; refreshKey: number; requestedRevision?: number }) {
  const [state, setState] = useState<Preview | null>(null);
  const [error, setError] = useState('');
  const [imageError, setImageError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [page, setPage] = useState(1);
  const {items, error: catalogError, retry: retryCatalog} = useResumeTemplates();
  const [reference, setReference] = useState(false);
  const [referenceId, setReferenceId] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    setState(null); setError(''); setImageError(false); setPage(1); setReference(false); setReferenceId('');
    const query = sessionId ? `?piSessionId=${encodeURIComponent(sessionId)}` : '';
    fetch(`/api/business/resume/documents/current${query}`, { signal: controller.signal, cache: 'no-store' }).then(async response => {
      if (!response.ok) throw new Error('无法读取个人简历，请重试。');
      const data = await response.json();
      if (!controller.signal.aborted) setState(data);
    }).catch(e => { if (!controller.signal.aborted) setError(e.message); });
    return () => controller.abort();
  }, [sessionId, refreshKey, attempt]);
  const template = items.find(item => item.id === (referenceId || state?.template)) || items[0];
  const hasPersonal = Boolean(state?.pdfReady && state.conversationId && Number.isSafeInteger(state.revision));
  // Never substitute an example for a valid personal PDF without explicit browsing.
  const personal = hasPersonal && !reference;
  const base = personal ? `/api/business/resume/documents/${encodeURIComponent(state!.conversationId!)}` : '';
  const pdf = personal ? `${base}/pdf?revision=${state!.revision}` : template?.originalPdfUrl;
  return <section className="resume-preview-panel" aria-label="LaTeX 简历预览">
    <header><h2>{personal ? '个人简历 PDF' : '默认模板 · 版式参考'}</h2><button type="button" onClick={() => setAttempt(v => v + 1)}>刷新</button></header>
    {error ? <p role="alert">{error} <button type="button" onClick={() => setAttempt(v => v + 1)}>重试</button></p> : !state ? <p role="status">正在读取简历…</p> : <>
      {requestedRevision !== undefined && requestedRevision !== state.revision && <p role="status">所选 PDF 为旧修订 v{requestedRevision}，不是当前版本；以下显示当前状态，不会冒充旧版本。</p>}
      {hasPersonal && <button type="button" onClick={() => {setReference(v => !v); setImageError(false);}}>{reference ? '返回个人 PDF' : '浏览模板参考（不替换个人 PDF）'}</button>}
      {!personal && <><label>只读模板参考 <select aria-label="浏览模板参考" value={template?.id || ''} onChange={e => {setReferenceId(e.target.value);setImageError(false);}}>{items.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>{catalogError ? <p role="alert">{catalogError} <button type="button" onClick={retryCatalog}>重试模板列表</button></p> : !template ? <p role="status">正在读取模板…</p> : <p>{templateCaption(template)}</p>}</>}
      <p className="resume-preview-note">{personal ? `修订 v${state.revision} · ${state.source === 'recent' ? '最近个人简历（其他会话）' : '当前会话简历'}。仅预览，不修改正文。` : hasPersonal ? '正在只读浏览模板参考；个人 PDF 保持不变，可随时返回。不会保存示例或切换实际模板。' : state.exists ? '当前个人简历尚无有效 PDF，以下仅显示模板。请在对话中编译当前版本；不会自动保存或修改正文。' : '尚无个人 PDF。以下为作者原版或合成示例适配版，仅供参考；不会创建简历或保存作者姓名、学校、公司及经历。'}</p>
      <div className="resume-preview-actions"><a href={pdf} download={personal ? 'resume.pdf' : 'template-example.pdf'}>下载完整 PDF</a>{personal && <><button disabled={page === 1} onClick={() => { setPage(v => v - 1); setImageError(false); }}>上一页</button><span>第 {page} 页</span><button disabled={page >= 100} onClick={() => { setPage(v => v + 1); setImageError(false); }}>下一页</button></>}</div>
      {imageError && <p role="status">{page > 1 ? '该页不存在或预览不可用。可返回上一页，或下载完整 PDF。' : '图片预览暂不可用，请下载完整 PDF。'}</p>}
      {(personal || template) && <img key={`${pdf}:${page}`} hidden={imageError} onError={() => setImageError(true)} src={personal ? `${base}/preview?revision=${state.revision}&page=${page}` : `/examples/${template!.id}.png`} alt={personal ? `个人简历 v${state.revision} 第 ${page} 页` : `${template!.name} · ${templateCaption(template!)}，不作为个人简历保存`} />}
    </>}
  </section>;
}
