import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { chapterById, chapters, quizBank, chapterIndex } from '../data/chapters.js'
import { useLearningStore, useChatStore } from '../store.js'
import { Markdown, extractHeadings } from '../components/Markdown.jsx'
import { IconArrowLeft, IconBookmark } from '../components/Icons.jsx'

// 随文笔记（独立组件，避免每次键入重渲染整章）
function ChapterNotes({ id }) {
  const notes = useLearningStore(s => s.notes)
  const setNote = useLearningStore(s => s.setNote)
  return (
    <div className="notes">
      <div className="notesTitle">随文笔记</div>
      <textarea
        className="notesInput"
        rows={3}
        placeholder="记录你的想法、疑问…（保存在本地）"
        value={notes[id] || ''}
        onChange={e => setNote(id, e.target.value)}
      />
    </div>
  )
}

// 章节测验（独立组件）
function Quiz({ id }) {
  const questions = quizBank[id]
  const quizResults = useLearningStore(s => s.quizResults)
  const setQuizResult = useLearningStore(s => s.setQuizResult)
  const [answers, setAnswers] = useState({})
  const [submitted, setSubmitted] = useState(false)

  if (!questions || questions.length === 0) return null

  const score = questions.reduce((acc, q, i) => acc + (answers[i] === q.answer ? 1 : 0), 0)
  const result = quizResults[id]

  return (
    <div className="quiz">
      <div className="quizTitle">本章测验</div>
      {questions.map((q, i) => (
        <div key={i} className="quizQ">
          <div className="quizQText">{i + 1}. {q.q}</div>
          <div className="quizOptions">
            {q.options.map((o, oi) => (
              <button
                key={oi}
                className={`quizOption${answers[i] === oi ? ' chosen' : ''}`}
                onClick={() => !submitted && setAnswers(a => ({ ...a, [i]: oi }))}
              >
                {o}
              </button>
            ))}
          </div>
        </div>
      ))}
      {!submitted ? (
        <button
          className="btn primary sm"
          onClick={() => { setSubmitted(true); setQuizResult(id, score, questions.length) }}
          disabled={Object.keys(answers).length < questions.length}
        >
          提交
        </button>
      ) : (
        <div className="quizResult">得分 {result?.score ?? score} / {questions.length}（AI 批改演示）</div>
      )}
    </div>
  )
}

export default function ChapterReader() {
  const { id } = useParams()
  const navigate = useNavigate()
  const chapter = chapterById(id)
  const bookmarks = useLearningStore(s => s.bookmarks)
  const toggleBookmark = useLearningStore(s => s.toggleBookmark)
  const setProgress = useLearningStore(s => s.setProgress)
  const setContext = useChatStore(s => s.setContext)
  const contentRef = useRef(null)
  const [pct, setPct] = useState(0)
  const [selection, setSelection] = useState('')

  // 阅读进度：滚动位置 → 百分比，写入 store（Home「继续学习」用到）
  useEffect(() => {
    const el = contentRef.current
    if (!el) return
    const onScroll = () => {
      const max = el.scrollHeight - el.clientHeight
      const p = max > 0 ? Math.min(1, el.scrollTop / max) : 0
      setPct(p)
      setProgress(id, p)
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => el.removeEventListener('scroll', onScroll)
  }, [id, setProgress])

  if (!chapter) {
    return (
      <div className="page scrollable">
        <p className="empty">未找到该章节</p>
        <button className="btn ghost" onClick={() => navigate('/knowledge')}>返回知识库</button>
      </div>
    )
  }

  const headings = extractHeadings(chapter.content)
  const bookmarked = bookmarks.includes(chapter.id)
  const idx = chapters.findIndex(c => c.id === chapter.id)
  const next = chapters[idx + 1] || null

  const scrollTo = (anchor) => {
    document.getElementById(anchor)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const onMouseUp = () => {
    const sel = window.getSelection()
    setSelection(sel ? sel.toString().trim() : '')
  }

  const askAboutSelection = () => {
    setContext({ title: chapter.title, snippet: selection.slice(0, 80) })
    navigate('/chat')
    setSelection('')
  }

  return (
    <div className="reader">
      <header className="readerHeader">
        <button className="iconButton" onClick={() => navigate('/knowledge')} aria-label="返回">
          <IconArrowLeft size={16} />
        </button>
        <div className="readerTitle">
          <h1>{chapter.title}</h1>
          <div className="readerMeta">
            {chapter.difficulty} · {chapter.readTime} · 更新于 {chapter.updated}
          </div>
        </div>
        <button
          className={`iconButton${bookmarked ? ' active' : ''}`}
          onClick={() => toggleBookmark(chapter.id)}
          aria-label="收藏"
        >
          <IconBookmark size={16} />
        </button>
      </header>

      {/* 阅读进度条 */}
      <div className="readerProgress">
        <div className="readerProgressFill" style={{ width: `${Math.round(pct * 100)}%` }} />
      </div>

      <div className="readerBody">
        <article className="readerContent" ref={contentRef} onMouseUp={onMouseUp}>
          <Markdown text={chapter.content} />

          {/* 学习闭环：笔记 + 测验 + 下一篇 */}
          <div className="readerFoot">
            <ChapterNotes id={chapter.id} />
            <Quiz id={chapter.id} />

            <div className="nextChapter">
              {next ? (
                <Link to={`/knowledge/${next.id}`} className="btn primary">下一篇：{next.title} →</Link>
              ) : (
                <span className="formHint">已到最后一章</span>
              )}
            </div>

            {chapter.related && chapter.related.length > 0 && (
              <div>
                <div className="notesTitle">相关章节</div>
                <div className="chipRow">
                  {chapter.related.map(t => {
                    const rid = chapterIndex[t]
                    return rid
                      ? <Link key={rid} to={`/knowledge/${rid}`} className="tag big">{t}</Link>
                      : <span key={t} className="tag big">{t}</span>
                  })}
                </div>
              </div>
            )}
          </div>
        </article>

        {headings.length > 0 && (
          <aside className="readerToc">
            <div className="tocTitle">目录</div>
            {headings.map((h, i) => (
              <button key={i} className={`tocItem lv${h.level}`} onClick={() => scrollTo(h.anchor)}>
                {h.text}
              </button>
            ))}
          </aside>
        )}
      </div>

      {selection && (
        <button className="askFab" onClick={askAboutSelection}>
          问 MINO AGENT：{selection.length > 16 ? selection.slice(0, 16) + '…' : selection}
        </button>
      )}
    </div>
  )
}
