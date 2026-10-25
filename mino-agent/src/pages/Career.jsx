import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { analyzeResume, matchJobs, organizeStarStory } from '../api.js'
import { IconCheck } from '../components/Icons.jsx'

export default function Career() {
  const [resume, setResume] = useState('')
  const [fileName, setFileName] = useState('')
  const [analysis, setAnalysis] = useState(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [matches, setMatches] = useState(null)
  const [star, setStar] = useState(null)
  const [starInput, setStarInput] = useState('')
  const [starLoading, setStarLoading] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef(null)

  const onFile = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setFileName(file.name)
    if (/\.(txt|md|markdown)$/i.test(file.name)) {
      const reader = new FileReader()
      reader.onload = () => setResume(reader.result)
      reader.readAsText(file)
    } else {
      setResume(`[已上传文件：${file.name}]（正文解析需后端解析，此处为演示）`)
    }
  }

  const doAnalyze = async () => {
    setAnalyzing(true)
    setError('')
    try {
      const result = await analyzeResume({ text: resume, attachmentIds: [] })
      setAnalysis(result)
      const m = await matchJobs({ profile: {}, target: {} }).catch(() => null)
      setMatches(m)
    } catch (err) {
      setError(err.message || '分析失败')
    } finally {
      setAnalyzing(false)
    }
  }

  const doStar = async () => {
    if (!starInput.trim()) return
    setStarLoading(true)
    setError('')
    try {
      setStar(await organizeStarStory(starInput.trim()))
    } catch (err) {
      setError(err.message || 'STAR 整理失败')
    } finally {
      setStarLoading(false)
    }
  }

  const exportMarkdown = () => {
    const md =
      `# 简历优化报告\n\n## 原始内容\n\n${resume}\n\n## 优化建议\n\n` +
      (analysis?.suggestions || []).map(t => `- ${t}`).join('\n') + '\n'
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = '简历优化建议.md'
    a.click()
    URL.revokeObjectURL(url)
  }

  const tips = analysis?.suggestions || []

  return (
    <div className="page scrollable">
      <header className="pageHeader">
        <h1>职业辅导</h1>
        <p className="pageSub">简历优化、岗位匹配、STAR 案例整理</p>
        <Link to="/resume" className="btn primary">进入 LaTeX 简历工作台 · 对话修改 / PDF 导出</Link>
      </header>

      {error && <p className="loginError">{error}</p>}

      <div className="careerGrid">
        {/* 简历优化 */}
        <section className="careerCard">
          <div className="careerCardTitle">简历优化</div>
          <p className="careerCardDesc">上传或粘贴简历，MINO AGENT 给出结构化建议并可导出</p>
          <input ref={fileRef} type="file" accept=".pdf,.docx,.md,.txt,.markdown" style={{ display: 'none' }} onChange={onFile} />
          <div className="uploadRow">
            <button className="btn outline sm" onClick={() => fileRef.current?.click()}>上传简历</button>
            {fileName && <span className="formHint">{fileName}</span>}
          </div>
          <textarea
            className="composerInput resumeInput"
            rows={6}
            placeholder="或在此粘贴简历内容…"
            value={resume}
            onChange={e => setResume(e.target.value)}
          />
          <div className="uploadRow">
            <button className="btn primary sm" onClick={doAnalyze} disabled={!resume.trim() || analyzing}>
              {analyzing ? '分析中…' : '分析简历'}
            </button>
            {analysis && <button className="btn ghost sm" onClick={exportMarkdown}>导出 Markdown</button>}
          </div>
          {analysis && (
            <>
              <p className="formHint">{analysis.summary}</p>
              {analysis.sections?.map((s, i) => (
                <div key={i}>
                  <div className="notesTitle">{s.title}</div>
                  <ul className="tipList">
                    {s.points.map((t, j) => <li key={j} className="fbLine hint"><IconCheck size={14} />{t}</li>)}
                  </ul>
                </div>
              ))}
              <ul className="tipList">
                {tips.map((t, i) => <li key={i} className="fbLine hint"><IconCheck size={14} />{t}</li>)}
              </ul>
            </>
          )}
        </section>

        {/* 岗位匹配 */}
        <section className="careerCard">
          <div className="careerCardTitle">岗位匹配</div>
          <p className="careerCardDesc">根据你的画像推荐适合的岗位方向</p>
          {matches === null ? (
            <>
              <div className="chipRow">
                {['产品经理', '运营', '后端开发', '数据分析'].map(p => (
                  <span key={p} className="tag big">{p}</span>
                ))}
              </div>
              <p className="formHint">完成一次简历分析后，这里会展示个性化匹配结果。</p>
            </>
          ) : (
            <div>
              {matches.items.map((m, i) => (
                <div key={i} className="aiBlock">
                  <div className="aiLabel">{m.title} · 匹配度 {Math.round(m.matchScore * 100)}%</div>
                  <div className="chipRow">
                    {m.reasons.map((r, j) => <span key={j} className="tag">{r}</span>)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* STAR 整理 */}
        <section className="careerCard">
          <div className="careerCardTitle">STAR 案例整理</div>
          <p className="careerCardDesc">把零散经历整理成可讲的故事</p>
          <textarea
            className="composerInput resumeInput"
            rows={3}
            placeholder="粘贴一段经历，AI 帮你整理成 STAR 结构…"
            value={starInput}
            onChange={e => setStarInput(e.target.value)}
          />
          <div className="uploadRow">
            <button className="btn outline sm" onClick={doStar} disabled={!starInput.trim() || starLoading}>
              {starLoading ? '整理中…' : '整理 STAR'}
            </button>
            <Link to="/guide/star" className="btn ghost sm">学习 STAR 方法</Link>
          </div>
          {star && (
            <div>
              {[
                ['S · 情境', star.situation],
                ['T · 任务', star.task],
                ['A · 行动', star.action],
                ['R · 结果', star.result],
              ].map(([label, text], i) => (
                <div key={i} className="fbLine hint"><IconCheck size={14} /><span><b>{label}</b>：{text}</span></div>
              ))}
              <p className="formHint">{star.tip}</p>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}