"use client";
import type { ResumeResult } from "@/lib/resume-result";
import "./resume-revision.css";

export function ResumeRevisionCard({ result, onOpenFile, onRetry }: { result: ResumeResult; onOpenFile?: (path: string) => void; onRetry?: () => void }) {
  const changed = result.changes !== undefined;
  return <section className="resume-revision-card" aria-label={`简历修订 ${result.revision} ${changed ? '修改前后对比' : 'PDF'}`}>
    <header><div><span className="resume-revision-kicker">{changed ? "已保存 · 真实修改记录" : "PDF 已编译"}</span><h3>{changed ? "简历修改前后对比" : "简历 PDF"}</h3></div><span className="resume-revision-version">{result.previousRevision !== undefined ? `v${result.previousRevision} → ` : ""}v{result.revision}</span></header>
    {changed && (result.changes!.length ? <div className="resume-revision-changes">{result.changes!.map((change, index) => <article key={`${index}-${change.field}`}><h4>{change.field}</h4><div className="resume-revision-columns"><div className="resume-revision-before"><b>修改前</b><p>{change.before || "（原内容为空）"}</p></div><div className="resume-revision-after"><b>修改后</b><p>{change.after || "（已移除内容）"}</p></div></div></article>)}</div> : <p>本次保存未改变简历内容。</p>)}
    {result.compileError && <div className="resume-revision-error" role="status"><strong>简历已保存，PDF 暂未生成</strong><p>{result.compileError}</p>{onRetry && <button type="button" onClick={onRetry}>重试编译（填入草稿）</button>}</div>}
    {!!result.warnings.length && <div className="resume-revision-warnings"><strong>排版提醒</strong><ul>{result.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul></div>}
    {result.pdfPath && onOpenFile && <footer><span>v{result.revision} · 可重新打开本次编译结果</span><button type="button" onClick={() => onOpenFile(result.pdfPath!)}>查看简历 PDF ↗</button></footer>}
  </section>;
}
