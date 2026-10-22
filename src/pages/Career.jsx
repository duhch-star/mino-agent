import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { IconCheck } from '../components/Icons.jsx'

function analyzeResume(text) {
  const tips = []
  if (text.length < 30) tips.push('内容偏少：建议补充项目经历与成果')
  else {
    if (!/\d/.test(text)) tips.push('量化结果较少：每条经历补一个可衡量的数据')
    if (!/我|负责|主导|推动/.test(text)) tips.push('多用「我」突出个人贡献，而非「我们」')
    tips.push('建议用 STAR 结构改写：情境 → 任务 → 行动 → 结果')
  }
  return tips
}

export default function Career() {
  const [resume, setResume] = useState('')
  const [fileName, setFileName] = useState('')
  const [tips, setTips] = useState(null)
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
      setResume(`[已上传文件：${file.name}]（正文解析需后端，此处为演示）`)
    }
  }

  const exportMarkdown = () => {
    const md =
      `# 简历优化报告\n\n## 原始内容\n\n${resume}\n\n## 优化建议\n\n` +
      (tips || []).map(t => `- ${t}`).join('\n') + '\n'
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = '简历优化建议.md'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="page scrollable">
      <header className="pageHeader">
        <h1>职业辅导</h1>
        <p className="pageSub">简历优化、岗位匹配、STAR 案例整理</p>
      </header>

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
            <button className="btn primary sm" onClick={() => setTips(analyzeResume(resume))} disabled={!resume.trim()}>分析简历</button>
            {tips && <button className="btn ghost sm" onClick={exportMarkdown}>导出 Markdown</button>}
          </div>
          {tips && (
            <ul className="tipList">
              {tips.map((t, i) => <li key={i} className="fbLine hint"><IconCheck size={14} />{t}</li>)}
            </ul>
          )}
        </section>

        {/* 岗位匹配 */}
        <section className="careerCard">
          <div className="careerCardTitle">岗位匹配</div>
          <p className="careerCardDesc">根据你的画像推荐适合的岗位方向</p>
          <div className="chipRow">
            {['产品经理', '运营', '后端开发', '数据分析'].map(p => (
              <span key={p} className="tag big">{p}</span>
            ))}
          </div>
          <p className="formHint">匹配结果将在接入画像后个性化排序。</p>
        </section>

        {/* STAR 整理 */}
        <section className="careerCard">
          <div className="careerCardTitle">STAR 案例整理</div>
          <p className="careerCardDesc">把零散经历整理成可讲的故事</p>
          <p className="formHint">每个改进点都能一键跳转到对应知识章节补课。</p>
          <Link to="/guide/star" className="btn outline sm">学习 STAR 方法</Link>
        </section>
      </div>
    </div>
  )
}
