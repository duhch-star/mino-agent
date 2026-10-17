import { useState } from 'react'
import { Link } from 'react-router-dom'
import { chapterIndex } from '../data/chapters.js'
import { IconCopy, IconCheck } from './Icons.jsx'

// 行内渲染：[[内链]] → `code` → **bold** → *italic*
function renderCodeBold(part, keyBase) {
  const codeParts = part.split(/(`[^`]+`)/g)
  return codeParts.map((seg, i) => {
    const key = `${keyBase}-${i}`
    if (seg.startsWith('`') && seg.endsWith('`') && seg.length > 1) {
      return <code key={key} className="md-code-inline">{seg.slice(1, -1)}</code>
    }
    const boldParts = seg.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g)
    return boldParts.map((p, j) => {
      const k = `${key}-${j}`
      if (p.startsWith('**') && p.endsWith('**') && p.length > 3) {
        return <strong key={k} className="md-strong">{p.slice(2, -2)}</strong>
      }
      if (p.startsWith('*') && p.endsWith('*') && p.length > 2) {
        return <em key={k} className="md-em">{p.slice(1, -1)}</em>
      }
      return p
    })
  })
}

function renderInline(text, keyBase) {
  const linkParts = text.split(/(\[\[[^\]]+\]\])/g)
  return linkParts.map((part, i) => {
    const key = `${keyBase}-${i}`
    if (part.startsWith('[[') && part.endsWith(']]')) {
      const title = part.slice(2, -2)
      const id = chapterIndex[title]
      if (id) return <Link key={key} to={`/knowledge/${id}`} className="md-link">{title}</Link>
      return part
    }
    return renderCodeBold(part, key)
  })
}

function CodeBlock({ lang, code }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard?.writeText(code).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }
  return (
    <div className="md-codeblock">
      <div className="codeblock-header">
        <span className="codeblock-lang">{lang || 'text'}</span>
        <button className="codeblock-copy" onClick={copy} aria-label="复制">
          {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
        </button>
      </div>
      <pre><code>{code}</code></pre>
    </div>
  )
}

function parseTableRow(line) {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim())
}

function isSeparator(line) {
  return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line)
}

// 逐块解析 markdown（段落 / 标题 / 表格 / 引用 / 列表 / 任务列表 / 代码块）
function parseBlocks(text) {
  const lines = text.split('\n')
  const blocks = []
  let i = 0
  let headingSeq = 0

  while (i < lines.length) {
    const line = lines[i]

    if (/^\s*```/.test(line)) {
      const lang = line.trim().slice(3).trim()
      const buf = []
      i++
      while (i < lines.length && !/^\s*```/.test(lines[i])) {
        buf.push(lines[i])
        i++
      }
      i++
      blocks.push({ type: 'code', lang, code: buf.join('\n') })
      continue
    }

    if (/^\s*\|/.test(line) && i + 1 < lines.length && isSeparator(lines[i + 1])) {
      const header = parseTableRow(line)
      const rows = []
      i += 2
      while (i < lines.length && /^\s*\|/.test(lines[i])) {
        rows.push(parseTableRow(lines[i]))
        i++
      }
      blocks.push({ type: 'table', header, rows })
      continue
    }

    const heading = line.match(/^(#{1,3})\s+(.*)$/)
    if (heading) {
      blocks.push({ type: 'heading', level: heading[1].length, text: heading[2], anchor: `h${++headingSeq}` })
      i++
      continue
    }

    if (/^\s*>\s?/.test(line)) {
      const quotes = []
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
        quotes.push(lines[i].replace(/^\s*>\s?/, ''))
        i++
      }
      blocks.push({ type: 'blockquote', text: quotes.join(' ') })
      continue
    }

    if (/^\s*[-*]\s*\[[ xX]\]/.test(line)) {
      const items = []
      while (i < lines.length && /^\s*[-*]\s*\[[ xX]\]/.test(lines[i])) {
        const m = lines[i].match(/^\s*[-*]\s*\[([ xX])\]\s*(.*)$/)
        items.push({ checked: m[1].toLowerCase() === 'x', text: m[2] })
        i++
      }
      blocks.push({ type: 'task', items })
      continue
    }

    if (/^\s*[-*]\s+/.test(line)) {
      const items = []
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, ''))
        i++
      }
      blocks.push({ type: 'ul', items })
      continue
    }

    if (/^\s*\d+\.\s+/.test(line)) {
      const items = []
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ''))
        i++
      }
      blocks.push({ type: 'ol', items })
      continue
    }

    if (line.trim() === '') {
      i++
      continue
    }

    const para = []
    while (i < lines.length && lines[i].trim() !== '' && !/^\s*(```|\||#{1,3}\s|>\s?|[-*]\s|[-*]\s*\[|\d+\.\s)/.test(lines[i])) {
      para.push(lines[i])
      i++
    }
    blocks.push({ type: 'paragraph', text: para.join(' ') })
  }

  return blocks
}

// 提取标题（用于生成目录 TOC），anchor 与 Markdown 渲染的标题 id 对齐
export function extractHeadings(text) {
  const headings = []
  let seq = 0
  for (const line of (text || '').split('\n')) {
    const m = line.match(/^(#{1,3})\s+(.*)$/)
    if (m) headings.push({ level: m[1].length, text: m[2], anchor: `h${++seq}` })
  }
  return headings
}

export function Markdown({ text }) {
  const blocks = parseBlocks(text || '')
  return (
    <div className="assistantBody">
      {blocks.map((b, i) => {
        switch (b.type) {
          case 'code':
            return <CodeBlock key={i} lang={b.lang} code={b.code} />
          case 'heading':
            return b.level === 1
              ? <h1 key={i} id={b.anchor} className="md-h1">{renderInline(b.text, i)}</h1>
              : b.level === 2
                ? <h2 key={i} id={b.anchor} className="md-h2">{renderInline(b.text, i)}</h2>
                : <h3 key={i} id={b.anchor} className="md-h3">{renderInline(b.text, i)}</h3>
          case 'table':
            return (
              <div key={i} className="md-table-wrap">
                <table className="md-table">
                  <thead>
                    <tr>{b.header.map((h, j) => <th key={j}>{renderInline(h, `${i}-h${j}`)}</th>)}</tr>
                  </thead>
                  <tbody>
                    {b.rows.map((row, r) => (
                      <tr key={r}>{row.map((c, cj) => <td key={cj}>{renderInline(c, `${i}-${r}-${cj}`)}</td>)}</tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          case 'blockquote':
            return <blockquote key={i} className="md-blockquote">{renderInline(b.text, i)}</blockquote>
          case 'task':
            return (
              <ul key={i} className="md-ul md-tasklist">
                {b.items.map((it, j) => (
                  <li key={j} className={it.checked ? 'md-task done' : 'md-task'}>
                    <span className="md-taskbox">{it.checked ? '✓' : ''}</span>
                    <span>{renderInline(it.text, `${i}-${j}`)}</span>
                  </li>
                ))}
              </ul>
            )
          case 'ul':
            return <ul key={i} className="md-ul">{b.items.map((it, j) => <li key={j}>{renderInline(it, `${i}-${j}`)}</li>)}</ul>
          case 'ol':
            return <ol key={i} className="md-ol">{b.items.map((it, j) => <li key={j}>{renderInline(it, `${i}-${j}`)}</li>)}</ol>
          default:
            return <p key={i} className="md-p">{renderInline(b.text, i)}</p>
        }
      })}
    </div>
  )
}
