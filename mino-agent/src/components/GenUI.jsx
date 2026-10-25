import { useEffect, useRef, useState } from 'react'
import { IconCheck, IconCopy, IconBook } from './Icons.jsx'

// ---------------------------------------------------------------------------
// 生成式 UI（GenUI）v2
// 服务端按对话场景返回 {type, props}，前端注册表分发渲染为可交互组件。
// 设计语言：
//   - 数据可视化：SVG 环形进度 / 雷达图（零外部依赖）
//   - 品牌层次：渐变头部、彩色徽章、柔和阴影
//   - 动效：入场弹入、进度条过渡、步骤高亮
// 组件注册表：resume_scorecard / job_match / knowledge_card / star_builder
//             / action_plan / interview_feedback / salary_advice / question_card
// ---------------------------------------------------------------------------

// ---------- 视觉基础件 ----------

function Bar({ value, max = 100, tone = 'grad', delay = 0 }) {
  const [w, setW] = useState(0)
  useEffect(() => {
    const t = setTimeout(() => setW(Math.max(0, Math.min(100, (value / max) * 100))), 30 + delay)
    return () => clearTimeout(t)
  }, [value, max, delay])
  return (
    <div className={`genuiBar genuiBar${tone !== 'grad' ? '' : ''}`}>
      <div className="genuiBarFill" data-tone={tone} style={{ width: `${w}%` }} />
    </div>
  )
}

/** 环形进度（SVG）：value 0-100 */
function Ring({ value, size = 84, stroke = 9, label, sub, tone = 'primary' }) {
  const [p, setP] = useState(0)
  useEffect(() => {
    const t = setTimeout(() => setP(Math.max(0, Math.min(100, value))), 60)
    return () => clearTimeout(t)
  }, [value])
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  return (
    <div className="genuiRing" style={{ width: size, height: size }} data-tone={tone}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} className="genuiRingTrack" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} className="genuiRingFill"
          strokeWidth={stroke} strokeDasharray={c}
          strokeDashoffset={c - (c * p) / 100}
          strokeLinecap="round" transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      </svg>
      <div className="genuiRingText">
        <div className="genuiRingNum">{Math.round(p)}</div>
        {sub && <div className="genuiRingSub">{sub}</div>}
        {label && <div className="genuiRingLabel">{label}</div>}
      </div>
    </div>
  )
}

/** 雷达图（SVG）：dims = [{name, score}]，最多 6 维 */
function Radar({ dims, size = 180 }) {
  if (!dims || dims.length < 3) return null
  const list = dims.slice(0, 6)
  const n = list.length
  const cx = size / 2, cy = size / 2, R = size / 2 - 26
  const pt = (i, v) => {
    const a = (Math.PI * 2 * i) / n - Math.PI / 2
    return [cx + R * v * Math.cos(a), cy + R * v * Math.sin(a)]
  }
  const [show, setShow] = useState(false)
  useEffect(() => { const t = setTimeout(() => setShow(true), 120); return () => clearTimeout(t) }, [])
  const rings = [0.25, 0.5, 0.75, 1]
  const poly = (v) => list.map((_, i) => pt(i, v).map(x => x.toFixed(1)).join(',')).join(' ')
  return (
    <div className="genuiRadar">
      <svg viewBox={`0 0 ${size} ${size}`} width="100%" style={{ maxHeight: 190 }}>
        {rings.map((v) => (
          <polygon key={v} points={poly(v)} className="genuiRadarGrid" />
        ))}
        {list.map((_, i) => {
          const [x, y] = pt(i, 1)
          return <line key={i} x1={cx} y1={cy} x2={x} y2={y} className="genuiRadarAxis" />
        })}
        {show && <polygon points={poly(1)} className="genuiRadarArea" />}
        {show && list.map((d, i) => {
          const [x, y] = pt(i, d.score / 100)
          return <circle key={i} cx={x} cy={y} r={2.6} className="genuiRadarDot" />
        })}
        {list.map((d, i) => {
          const [x, y] = pt(i, 1.18)
          return <text key={i} x={x} y={y} className="genuiRadarLabel">{d.name}</text>
        })}
      </svg>
    </div>
  )
}

function Badge({ children, tone = 'info' }) {
  return <span className={`genuiBadge genuiBadge${tone}`}>{children}</span>
}

function Section({ title, icon, children, accent }) {
  return (
    <div className="genuiSection">
      <div className="genuiSectionHead">
        <span className="genuiSectionDot" data-accent={accent || ''} />
        {title}
        {icon}
      </div>
      <div className="genuiSectionBody">{children}</div>
    </div>
  )
}

function GoChapter({ id, label = '去学本章 →', primary = false }) {
  if (!id) return null
  return (
    <button className={primary ? 'genuiBtn genuiBtnPrimary' : 'genuiLink'} onClick={() =>
      window.dispatchEvent(new CustomEvent('genui:goto', { detail: { chapterId: id } }))}>
      {label}
    </button>
  )
}

async function copyText(text, done) {
  try {
    await navigator.clipboard.writeText(text)
    done && done(true)
    setTimeout(() => done && done(false), 1400)
  } catch { /* noop */ }
}

// ---------- 1. 简历诊断报告 ----------

function ResumeScorecard({ props }) {
  const [copied, setCopied] = useState(false)
  const [open, setOpen] = useState(-1)
  const dims = props.dimensions || []
  const overall = props.overall ?? 0
  const tone = overall >= 80 ? 'success' : overall >= 60 ? 'primary' : 'warn'
  return (
    <div className="genuiCard" data-enter>
      <div className="genuiHead">
        <span className="genuiHeadIcon genuiHeadIconGrad">📋</span>
        <div className="genuiHeadTitles">
          <div className="genuiTitle">简历诊断报告</div>
          <div className="genuiSub">综合评估 · 含图表与逐项建议</div>
        </div>
        <Ring value={overall} size={84} sub="综合分" tone={tone} />
      </div>

      <div className="genuiCardGrid">
        <div>
          <Section title="评分维度" >
            {dims.map((d, i) => (
              <div className="genuiDim" key={i}>
                <div className="genuiDimRow">
                  <span className="genuiDimName">{d.name}</span>
                  <Bar value={d.score} delay={i * 90} />
                  <span className="genuiDimScore" data-tone={d.score >= 80 ? 'success' : d.score >= 60 ? 'primary' : 'warn'}>{d.score}</span>
                  <button className="genuiDimToggle" aria-label="展开详情" onClick={() => setOpen(open === i ? -1 : i)}>
                    {open === i ? '−' : '+'}
                  </button>
                </div>
                {open === i && <div className="genuiDimNote">{d.note}</div>}
              </div>
            ))}
          </Section>
        </div>
        <Radar dims={dims} />
      </div>

      {(props.highlights || []).length > 0 && (
        <Section title="亮点" icon={<span className="genuiSectionEmoji">✨</span>}>
          <div className="genuiTagWrap">
            {props.highlights.map((h, i) => <Badge key={i} tone="success">{h}</Badge>)}
          </div>
        </Section>
      )}
      {(props.suggestions || []).length > 0 && (
        <Section title="优化建议" icon={<span className="genuiSectionEmoji">🎯</span>}>
          <ol className="genuiSuggest">
            {props.suggestions.map((s, i) => <li key={i}>{s}</li>)}
          </ol>
        </Section>
      )}

      <div className="genuiFooter">
        <GoChapter id={props.chapterId} primary />
        <button className="genuiBtn" onClick={() => copyText(
          `简历诊断 · 综合分 ${overall}\n\n` +
          dims.map(d => `· ${d.name} ${d.score}/100：${d.note}`).join('\n') +
          '\n\n建议：\n' + (props.suggestions || []).map(s => `· ${s}`).join('\n'), setCopied)}>
          {copied ? <IconCheck /> : <IconCopy />} {copied ? '已复制' : '复制报告'}
        </button>
      </div>
    </div>
  )
}

// ---------- 2. 岗位匹配度 ----------

function JobMatch({ props }) {
  const matches = props.matches || []
  const best = Math.max(...matches.map(m => m.matchScore || 0), 0)
  const star = (v) => `${'★'.repeat(Math.round(v))}${'☆'.repeat(5 - Math.round(v))}`
  return (
    <div className="genuiCard" data-enter>
      <div className="genuiHead">
        <span className="genuiHeadIcon genuiHeadIconGrad genuiHeadIconAlt">🎯</span>
        <div className="genuiHeadTitles">
          <div className="genuiTitle">岗位匹配度</div>
          <div className="genuiSub">关键词命中分析 · 越靠前越推荐优先申请</div>
        </div>
        {matches.length > 0 && <Ring value={best * 100} size={72} stroke={8} sub="最佳匹配" />}
      </div>
      {matches.length === 0 && <div className="genuiEmpty">请补充目标岗位描述后再试</div>}
      {matches.map((m, i) => (
        <div className="genuiMatch" key={i}>
          <div className="genuiMatchTop">
            <span className={`genuiRank genuiRank${i}`}>{i + 1}</span>
            <span className="genuiDimName genuiMatchTitle">{m.title}</span>
            <span className="genuiStars">{star(m.matchScore * 5)}</span>
            <span className="genuiDimScore" data-tone={(m.matchScore || 0) >= 0.7 ? 'success' : (m.matchScore || 0) >= 0.5 ? 'primary' : 'warn'}>
              {Math.round((m.matchScore || 0) * 100)}%
            </span>
          </div>
          <Bar value={(m.matchScore || 0) * 100} delay={i * 120} />
          <div className="genuiMatchReasons">
            {(m.reasons || []).map((r, j) => <Badge key={j} tone="success">✓ {r}</Badge>)}
            {(m.missing || []).map((r, j) => <Badge key={`m${j}`} tone="warn">＋ {r}</Badge>)}
          </div>
        </div>
      ))}
    </div>
  )
}

// ---------- 3. 知识章节推荐 ----------

function KnowledgeCard({ props, onOpenChapter }) {
  const chapters = props.chapters || []
  return (
    <div className="genuiCard" data-enter>
      <div className="genuiHead">
        <span className="genuiHeadIcon genuiHeadIconGrad">📚</span>
        <div className="genuiHeadTitles">
          <div className="genuiTitle">推荐补课章节</div>
          <div className="genuiSub">{props.topic ? `围绕「${props.topic}」匹配到的知识：` : '根据提问匹配到的知识章节：'}</div>
        </div>
      </div>
      {chapters.map((c, i) => (
        <div className="genuiChapter" key={`${c.chapterId}-${i}`}>
          <div className="genuiChapterHead">
            <span className="genuiChapterNum">{String(i + 1).padStart(2, '0')}</span>
            <div>
              <div className="genuiChapterTitle">{c.title}</div>
              <div className="genuiChapterSummary">{c.summary}</div>
            </div>
          </div>
          <div className="genuiChapterActions">
            <span className="genuiChapterMeta">约 {Math.max(3, Math.round((c.summary || '').length / 60))} 分钟读完</span>
            <button className="genuiLink" onClick={() => {
              if (onOpenChapter) onOpenChapter(c.chapterId)
              window.dispatchEvent(new CustomEvent('genui:goto', { detail: { chapterId: c.chapterId } }))
            }}>阅读完整章节 →</button>
          </div>
        </div>
      ))}
    </div>
  )
}

// ---------- 4. STAR 素材整理 ----------

const STAR_STEPS = [
  { k: 'S', label: '情境', hint: '背景、时间、面对的约束' },
  { k: 'T', label: '任务', hint: '要达成的目标、职责' },
  { k: 'A', label: '行动', hint: '你具体做了什么、怎么做的' },
  { k: 'R', label: '结果', hint: '可量化的成果、评价' },
]

function StarBuilder({ props }) {
  const [parts, setParts] = useState({ S: '', T: '', A: '', R: '' })
  const [step, setStep] = useState(0)
  const [tip, setTip] = useState('')
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)

  const askStar = async () => {
    setBusy(true); setTip('')
    const experience = (props.experience || '').trim() || '我在项目中担任了核心角色'
    try {
      const tokens = JSON.parse(localStorage.getItem('mino_tokens') || 'null')
      const resp = await fetch('/api/career/star/organize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: tokens?.accessToken ? `Bearer ${tokens.accessToken}` : '',
        },
        body: JSON.stringify({ experience, targetRole: '' }),
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data.error?.message || '生成失败')
      const map = { S: 'situation', T: 'task', A: 'action', R: 'result' }
      const next = { ...parts }
      for (const k of ['S', 'T', 'A', 'R']) {
        const val = data[map[k]] || data[k.toLowerCase()] || data[k]
        if (val && typeof val === 'string') next[k] = val
      }
      setParts(next)
      if (data.tip) setTip(data.tip)
      setStep(3)
    } catch { setTip('生成失败，请稍后重试') } finally { setBusy(false) }
  }

  const copyAll = () => copyText(
    `S（情境）：${parts.S}\nT（任务）：${parts.T}\nA（行动）：${parts.A}\nR（结果）：${parts.R}`, setCopied)

  const complete = (k) => Boolean(parts[k]?.trim())

  return (
    <div className="genuiCard" data-enter>
      <div className="genuiHead">
        <span className="genuiHeadIcon genuiHeadIconGrad">⭐</span>
        <div className="genuiHeadTitles">
          <div className="genuiTitle">STAR 素材整理</div>
          <div className="genuiSub">把经历组织成「情境 → 任务 → 行动 → 结果」</div>
        </div>
      </div>

      {/* 步骤引导条 */}
      <div className="genuiStepper">
        {STAR_STEPS.map((s, i) => (
          <button key={s.k} className={`genuiStep ${step === i ? 'active' : ''} ${complete(s.k) ? 'done' : ''}`}
            onClick={() => setStep(i)} title={s.hint}>
            <span className="genuiStepDot">{complete(s.k) ? <IconCheck size={10} /> : s.k}</span>
            <span className="genuiStepLabel">{s.label}</span>
          </button>
        ))}
      </div>

      <div className="genuiStarWorkspace">
        <div className="genuiStarHint">{STAR_STEPS[step].hint}</div>
        <div className="genuiStarRow">
          <span className="genuiStarKey">{STAR_STEPS[step].k}</span>
          <textarea
            className="genuiInput genuiTextarea" rows={2}
            value={parts[STAR_STEPS[step].k]}
            placeholder={`${STAR_STEPS[step].label}：${STAR_STEPS[step].hint}…`}
            onChange={e => setParts(p => ({ ...p, [STAR_STEPS[step].k]: e.target.value }))} />
        </div>
        <div className="genuiFooter">
          <button className="genuiBtn genuiBtnPrimary" onClick={askStar} disabled={busy}>
            {busy ? '生成中…' : step < 3 ? 'AI 生成完整 STAR' : '重新生成'}
          </button>
          <button className="genuiBtn" onClick={copyAll} disabled={!parts.S && !parts.T && !parts.A && !parts.R}>
            {copied ? <IconCheck /> : <IconCopy />} 复制卡片
          </button>
          <GoChapter id="ch_star" />
        </div>
        {tip && <div className="genuiStarTip">{tip}</div>}
      </div>
    </div>
  )
}

// ---------- 5. 行动计划 ----------

function ActionPlan({ props }) {
  const [checked, setChecked] = useState({})
  const steps = props.steps || []
  const done = steps.filter((_, i) => checked[i]).length
  const pct = steps.length ? Math.round((done / steps.length) * 100) : 0
  return (
    <div className="genuiCard" data-enter>
      <div className="genuiHead">
        <span className="genuiHeadIcon genuiHeadIconGrad">🗺️</span>
        <div className="genuiHeadTitles">
          <div className="genuiTitle">{props.title || '行动计划'}</div>
          <div className="genuiSub">完成一项勾一项，进度实时保存</div>
        </div>
        <Ring value={pct} size={64} stroke={7} sub={pct === 100 ? '完成' : `${done}/${steps.length}`} tone={pct === 100 ? 'success' : 'primary'} />
      </div>
      <ol className="genuiStepsCheck">
        {steps.map((s, i) => (
          <li key={i} className={checked[i] ? 'checked' : ''}>
            <button className="genuiCheck" aria-label={`标记完成：${s}`} onClick={() => setChecked(c => ({ ...c, [i]: !c[i] }))}>
              {checked[i] ? <IconCheck size={11} /> : null}
            </button>
            <span className="genuiStepText">{s}</span>
          </li>
        ))}
      </ol>
      <div className="genuiProgress">
        <div className="genuiProgressFill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

// ---------- 6. 面试点评 ----------

function InterviewFeedback({ props }) {
  const score = props.score ?? 0
  return (
    <div className="genuiCard" data-enter>
      <div className="genuiHead">
        <span className="genuiHeadIcon genuiHeadIconGrad">🎤</span>
        <div className="genuiHeadTitles">
          <div className="genuiTitle">面试表现点评</div>
          <div className="genuiSub">{props.label || '基于回答的即时评估'}</div>
        </div>
        <Ring value={score * 100} size={74} stroke={8} sub="评分" tone={score >= 0.75 ? 'success' : score >= 0.5 ? 'primary' : 'warn'} />
      </div>
      {(props.good || []).length > 0 && (
        <Section title="做得好" icon={<span className="genuiSectionEmoji">👍</span>}>
          <div className="genuiTagWrap">
            {props.good.map((g, i) => <Badge key={i} tone="success">{g}</Badge>)}
          </div>
        </Section>
      )}
      {(props.improve || []).length > 0 && (
        <Section title="待改进" icon={<span className="genuiSectionEmoji">💡</span>}>
          <ul className="genuiSuggest">{props.improve.map((m, i) => <li key={i}>{m}</li>)}</ul>
        </Section>
      )}
      {props.reference && (
        <div className="genuiStarTip"><b>参考话术：</b>{props.reference}</div>
      )}
    </div>
  )
}

// ---------- 7. 谈薪建议 ----------

function SalaryAdvice({ props }) {
  const band = props.band || {}
  const lo = band.low ?? 0, hi = band.high ?? 0
  const target = props.target ?? 0
  const pct = hi > lo ? Math.round(((target - lo) / (hi - lo)) * 100) : 0
  return (
    <div className="genuiCard" data-enter>
      <div className="genuiHead">
        <span className="genuiHeadIcon genuiHeadIconGrad">💰</span>
        <div className="genuiHeadTitles">
          <div className="genuiTitle">{props.title || '谈薪建议'}</div>
          <div className="genuiSub">基于行业区间与你的背景估算</div>
        </div>
      </div>
      <div className="genuiSalaryBand">
        <div className="genuiSalaryScale">
          <div className="genuiSalaryLine" />
          <div className="genuiSalaryFill" style={{ left: `${Math.max(2, Math.min(98, pct))}%` }} />
          <span className="genuiSalaryMarker" style={{ left: `${Math.max(2, Math.min(98, pct))}%` }}>目标 {target}</span>
        </div>
        <div className="genuiSalaryLabels">
          <span>市场低位 {lo}k</span>
          <span>市场高位 {hi}k</span>
        </div>
      </div>
      {(props.suggestions || []).length > 0 && (
        <Section title="谈判要点" icon={<span className="genuiSectionEmoji">🛡️</span>}>
          <ul className="genuiSuggest">{props.suggestions.map((s, i) => <li key={i}>{s}</li>)}</ul>
        </Section>
      )}
      {props.script && <div className="genuiStarTip"><b>开场话术：</b>{props.script}</div>}
    </div>
  )
}

// ---------- 8. 高频面试题 ----------

function QuestionCard({ props }) {
  const [open, setOpen] = useState(0)
  const questions = props.questions || []
  return (
    <div className="genuiCard" data-enter>
      <div className="genuiHead">
        <span className="genuiHeadIcon genuiHeadIconGrad">❓</span>
        <div className="genuiHeadTitles">
          <div className="genuiTitle">{props.title || '高频面试题'}</div>
          <div className="genuiSub">点击展开答题要点 · 共 {questions.length} 题</div>
        </div>
      </div>
      {questions.map((q, i) => (
        <div className={`genuiQA ${open === i ? 'open' : ''}`} key={i}>
          <button className="genuiQABtn" onClick={() => setOpen(open === i ? -1 : i)}>
            <span className="genuiQANum">{i + 1}</span>
            <span className="genuiQATitle">{q.question}</span>
            <span className="genuiQAToggle">{open === i ? '−' : '+'}</span>
          </button>
          {open === i && q.answer && <div className="genuiQAAnswer">{q.answer}</div>}
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// GenUI 注册表
// ---------------------------------------------------------------------------

const REGISTRY = {
  resume_scorecard: ResumeScorecard,
  job_match: JobMatch,
  knowledge_card: KnowledgeCard,
  star_builder: StarBuilder,
  action_plan: ActionPlan,
  interview_feedback: InterviewFeedback,
  salary_advice: SalaryAdvice,
  question_card: QuestionCard,
}

export default function GenUI({ ui, onOpenChapter }) {
  if (!ui || !ui.type) return null
  const Component = REGISTRY[ui.type]
  if (!Component) return null
  return <Component props={ui.props || {}} onOpenChapter={onOpenChapter} />
}

export { GoChapter }