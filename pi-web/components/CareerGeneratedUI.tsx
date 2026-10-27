"use client";

import { useId, useState } from "react";
import { careerUIPlainText } from "../lib/career-ui";
import type { CareerUIData, CareerUIItem, CareerUIStatus, CareerUIType } from "../lib/career-ui";
import "./career-generated-ui.css";

export interface CareerGeneratedUIProps {
  data: CareerUIData;
  /** Put this prompt into the composer as a draft; never send automatically. */
  onAction?: (prompt: string) => void;
}
const META: Record<CareerUIType, { label: string; mark: string; note: string }> = {
  "job-match": { label: "岗位匹配", mark: "◎", note: "逐项对照要求，找到值得投入的机会" },
  "resume-review": { label: "简历诊断", mark: "↗", note: "保留真实经历，让你的价值更清晰" },
  "interview-feedback": { label: "面试复盘", mark: "◈", note: "从回答证据出发，打磨下一次表达" },
  "action-plan": { label: "行动计划", mark: "✓", note: "把下一步，变成可以着手的小事" },
  "application-tracker": { label: "求职进度", mark: "▤", note: "用户信息，不自动投递" },
  "learning-roadmap": { label: "成长路线", mark: "◷", note: "循序渐进，把目标拆解为有依据的里程碑" },
  "offer-compare": { label: "机会对比", mark: "⇄", note: "比较事实与未知项，选择仅用于进一步讨论" },
  "skill-matrix": { label: "能力矩阵", mark: "▦", note: "基于已有证据看优势，不把未知当作零分" },
};
const STATUS: Record<CareerUIStatus, string> = {
  strength: "优势", gap: "待提升", unknown: "待确认", todo: "待开始", doing: "进行中", done: "已完成",
};
function Evidence({ item }: { item: CareerUIItem }) {
  return item.evidence ? <details className="career-evidence"><summary>查看依据</summary><p>{item.evidence}</p></details> : <span className="career-missing-evidence">尚无可核实依据</span>;
}
function Badge({ status }: { status?: CareerUIStatus }) {
  return <span className={`career-badge career-status-${status ?? "unknown"}`}>{STATUS[status ?? "unknown"]}</span>;
}
function Score({ item, bar = false }: { item: CareerUIItem; bar?: boolean }) {
  const { score, maxScore, evidence } = item;
  if (typeof score !== "number" || typeof maxScore !== "number" || !Number.isFinite(score) || !Number.isFinite(maxScore) || maxScore <= 0 || score < 0 || score > maxScore || !evidence?.trim()) return null;
  return <div className="career-score"><span className="career-score-value">{score}<small> / {maxScore}</small></span>{bar && <progress aria-label={`${item.title}评分`} value={score} max={maxScore} />}</div>;
}
function ItemHeading({ item, index }: { item: CareerUIItem; index?: number }) {
  return <div className="career-item-heading">{index !== undefined && <span className="career-number">{String(index + 1).padStart(2, "0")}</span>}<h4>{item.title}</h4><Badge status={item.status} /></div>;
}
function Description({ item }: { item: CareerUIItem }) {
  return item.description ? <p className="career-description">{item.description}</p> : null;
}
function ActionPlan({ data }: { data: CareerUIData }) {
  // Scoped to this rendered plan, never persisted or interpreted as tool execution.
  const [checked, setChecked] = useState<Set<string>>(() => new Set());
  return <><p className="career-notice">本地勾选，不代表已执行 <span>{data.items.filter((item) => checked.has(item.id)).length} / {data.items.length}</span></p><ol className="career-plan">{data.items.map((item, index) => <li key={item.id} className={checked.has(item.id) ? "is-checked" : ""}><div className="career-plan-top"><label className="career-check"><input type="checkbox" checked={checked.has(item.id)} onChange={(event) => { const done = event.target.checked; setChecked((previous) => { const next = new Set(previous); if (done) next.add(item.id); else next.delete(item.id); return next; }); }} /><span>{item.title}</span></label><span className="career-step">STEP {String(index + 1).padStart(2, "0")}</span></div><Badge status={item.status} /><Description item={item} /><Evidence item={item} /></li>)}</ol></>;
}
function Tracker({ data }: { data: CareerUIData }) {
  const groups: { key: string; label: string; items: CareerUIItem[] }[] = [
    { key: "todo", label: "待开始", items: data.items.filter((item) => item.status === "todo") },
    { key: "doing", label: "进行中", items: data.items.filter((item) => item.status === "doing") },
    { key: "done", label: "已完成", items: data.items.filter((item) => item.status === "done") },
    { key: "unknown", label: "待确认", items: data.items.filter((item) => !["todo", "doing", "done"].includes(item.status ?? "unknown")) },
  ];
  return <div className="career-tracker">{groups.filter((group) => group.items.length > 0).map((group) => <section className={`career-track-group career-track-${group.key}`} key={group.key}><h4><span className="career-dot" />{group.label}<span className="career-count">{group.items.length}</span></h4>{group.items.map((item) => <article className="career-track-item" key={item.id}><h5>{item.title}</h5><Description item={item} /><Evidence item={item} /></article>)}</section>)}</div>;
}
function Roadmap({ data }: { data: CareerUIData }) {
  return <ol className="career-roadmap">{data.items.map((item, index) => <li key={item.id}><span className="career-milestone" aria-hidden="true">{index + 1}</span><article><ItemHeading item={item} /><Description item={item} /><Evidence item={item} /></article></li>)}</ol>;
}
function Compare({ data, onAction }: CareerGeneratedUIProps) {
  const [selected, setSelected] = useState<string | null>(null);
  return <><p className="career-notice">选择不会投递、接受 Offer 或修改业务记录。</p><div className="career-compare" role="group" aria-label="比较求职机会">{data.items.map(item => <article key={item.id} className={selected === item.id ? 'is-selected' : ''}><ItemHeading item={item} /><Description item={item} /><Score item={item} bar /><Evidence item={item} /><button type="button" aria-pressed={selected === item.id} onClick={() => setSelected(selected === item.id ? null : item.id)}>{selected === item.id ? '已选择 · 再次点击取消' : '选择深入比较'}</button></article>)}</div>{selected && onAction && <div className="career-compare-confirm"><button type="button" onClick={() => onAction(`请基于已有事实，进一步分析「${data.items.find(item => item.id === selected)?.title}」的优劣、未知项和需要向招聘方确认的问题。`)}>将比较问题填入草稿 ↗</button></div>}</>;
}
function SkillMatrix({ data }: { data: CareerUIData }) {
  const [filter, setFilter] = useState('all');
  const options = [{id:'all',label:'全部'}, {id:'strength',label:'优势'}, {id:'gap',label:'待提升'}, {id:'unknown',label:'待确认'}];
  const status = (item: CareerUIItem) => ['strength','gap'].includes(item.status || '') ? item.status : 'unknown';
  const visible = data.items.filter(item => filter === 'all' || status(item) === filter);
  return <><div className="career-filters" role="group" aria-label="筛选能力状态">{options.map(option => <button key={option.id} type="button" aria-pressed={filter === option.id} onClick={() => setFilter(option.id)}>{option.label}<span>{data.items.filter(item => option.id === 'all' || status(item) === option.id).length}</span></button>)}</div><p className="career-filter-result" role="status">显示 {visible.length} / {data.items.length} 项能力 · 仅筛选展示，不修改评估</p>{visible.length ? <div className="career-skill-grid">{visible.map(item => <article key={item.id}><ItemHeading item={item} /><Score item={item} bar /><Description item={item} /><Evidence item={item} /></article>)}</div> : <p className="career-empty">当前筛选暂无项目，可切换“全部”查看。</p>}</>;
}
/** Render validated career data only; all model content remains escaped React text. */
export function CareerGeneratedUI({ data, onAction }: CareerGeneratedUIProps) {
  const headingId = useId();
  const [collapsed, setCollapsed] = useState(false);
  const [copyStatus, setCopyStatus] = useState('');
  const meta = META[data.type];
  const copy = async () => {
    const content = careerUIPlainText(data);
    try { await navigator.clipboard.writeText(content); setCopyStatus('已复制'); }
    catch { setCopyStatus('复制失败，请手动选择文字'); }
  };
  return <section className={`career-ui career-ui-${data.type}`} aria-labelledby={headingId}>
    <header className="career-header"><div className="career-kicker"><span aria-hidden="true">{meta.mark}</span><span>MINO / {meta.label}</span></div><h3 id={headingId}>{data.title}</h3><p>{data.summary ?? meta.note}</p></header>
    <div className="career-toolbar"><span>{data.items.length} 个条目</span><button type="button" onClick={copy} aria-label={`复制${data.title}`}>复制内容</button><button type="button" aria-expanded={!collapsed} aria-controls={`${headingId}-content`} onClick={() => setCollapsed(v => !v)}>{collapsed ? '展开卡片' : '收起卡片'}</button><span role="status">{copyStatus}</span></div>
    <div id={`${headingId}-content`} hidden={collapsed}>
    {data.type === "application-tracker" && <p className="career-notice">用户信息，不自动投递 · 状态来自本次对话，非平台同步</p>}
    <div className="career-body">
      {data.items.length === 0 ? <p className="career-empty">暂无条目，补充信息后可以继续完善。</p> : data.type === "learning-roadmap" ? <Roadmap data={data} /> : data.type === "offer-compare" ? <Compare data={data} onAction={onAction} /> : data.type === "skill-matrix" ? <SkillMatrix data={data} /> : data.type === "action-plan" ? <ActionPlan key={JSON.stringify(data)} data={data} /> : data.type === "application-tracker" ? <Tracker data={data} /> : <div className="career-items">{data.items.map((item, index) => <article className={`career-item career-status-${item.status ?? "unknown"}`} key={item.id}>
        <ItemHeading item={item} index={data.type === "job-match" ? index : undefined} />
        <Description item={item} />
        {data.type === "resume-review" && (item.before || item.after) && <div className="career-revision"><div className="career-before"><span>原始表达</span><p>{item.before ?? "未提供原文"}</p></div><div className="career-after"><span>建议表达</span><p>{item.after ?? "待补充真实经历后改写"}</p></div></div>}
        <Score item={item} bar={data.type === "interview-feedback"} />
        <Evidence item={item} />
      </article>)}</div>}
    </div>
    {onAction && !!data.actions?.length && <footer className="career-actions"><span>继续完善 · 仅填入草稿，确认后发送</span><div>{data.actions.map((action, index) => <button type="button" key={`${action.label}-${index}`} onClick={() => onAction(action.prompt)}>{action.label}<span aria-hidden="true">↗</span></button>)}</div></footer>}
    </div>
    <div className="career-footnote">AI 辅助整理 · 请核对事实与依据</div>
  </section>;
}
