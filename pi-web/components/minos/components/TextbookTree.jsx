import { useState } from 'react'
import { IconChevronDown } from './Icons.jsx'

function TreeNode({ label, depth = 0, children }) {
  const [open, setOpen] = useState(depth < 2) // 前两级默认展开
  const hasChildren = Array.isArray(children) && children.length > 0
  return (
    <div className="treeNode">
      <button
        type="button"
        className={`treeLabel${hasChildren ? '' : ' leaf'}`}
        style={{ paddingLeft: 8 + depth * 16 }}
        onClick={() => hasChildren && setOpen(o => !o)}
      >
        {hasChildren && <span className={`treeCaret${open ? ' open' : ''}`}><IconChevronDown size={12} /></span>}
        <span className="treeLabelText">{label}</span>
      </button>
      {open && hasChildren && <div className="treeChildren">{children}</div>}
    </div>
  )
}

function ChapterNode({ chapter, depth }) {
  if (chapter.sections && chapter.sections.length > 0) {
    return (
      <TreeNode label={chapter.title} depth={depth}>
        {chapter.sections.map((s, k) => (
          <div key={k} className="treeLeaf" style={{ paddingLeft: 8 + (depth + 1) * 16 }}>{s}</div>
        ))}
      </TreeNode>
    )
  }
  return <div className="treeLeaf chapter" style={{ paddingLeft: 8 + depth * 16 }}>{chapter.title}</div>
}

export default function TextbookTree({ groups }) {
  return (
    <div className="textbookTree">
      {groups.map(g => (
        <TreeNode key={g.id} label={g.title} depth={0}>
          {g.textbooks.map(tb => (
            <TreeNode key={tb.id} label={`${tb.name} · ${tb.edition}`} depth={1}>
              {tb.parts.map((p, i) => (
                <TreeNode key={i} label={p.title} depth={2}>
                  {p.chapters.map((ch, j) => <ChapterNode key={j} chapter={ch} depth={3} />)}
                </TreeNode>
              ))}
            </TreeNode>
          ))}
        </TreeNode>
      ))}
    </div>
  )
}
