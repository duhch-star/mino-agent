import { useId, useState } from 'react'

const STATUS_LABELS = { running: '运行中', completed: '已完成', failed: '失败 / 中断' }

function formatJson(value) {
  if (value === undefined) return '未提供'
  if (typeof value === 'string') {
    try { return JSON.stringify(JSON.parse(value), null, 2) } catch { return JSON.stringify(value, null, 2) }
  }
  return JSON.stringify(value, null, 2)
}

function JsonBlock({ label, value }) {
  const [copyStatus, setCopyStatus] = useState('')
  const text = formatJson(value)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopyStatus('已复制')
    } catch {
      setCopyStatus('复制失败，请选择文本复制')
    }
  }
  return <div className="toolCallJson">
    <div className="toolCallJsonHeader">
      <strong>{label}</strong>
      <button type="button" onClick={copy} aria-label={`复制工具调用${label}`}>复制</button>
    </div>
    {copyStatus && <span className="toolCallCopyStatus" role="status">{copyStatus}</span>}
    {/* React 文本节点转义内容，不把工具返回值当 HTML 或 Markdown 执行。 */}
    <pre tabIndex={0} aria-label={`工具调用${label} JSON`}><code>{text}</code></pre>
  </div>
}

export default function ToolCalls({ toolCalls }) {
  const listId = useId()
  const [expanded, setExpanded] = useState({})
  const [expandNew, setExpandNew] = useState(false)
  if (!Array.isArray(toolCalls) || toolCalls.length === 0) return null
  const setAll = open => {
    setExpandNew(open)
    setExpanded(Object.fromEntries(toolCalls.map(call => [call.id, open])))
  }
  return <section className="toolCalls" aria-label="本轮工具调用">
    <div className="toolCallsHeader">
      <span>工具调用 · {toolCalls.length}</span>
      <div className="toolCallsActions">
        <button type="button" onClick={() => setAll(true)} aria-controls={listId}>全部展开</button>
        <button type="button" onClick={() => setAll(false)} aria-controls={listId}>全部折叠</button>
      </div>
    </div>
    <div id={listId}>
      {toolCalls.map(call => <details className="toolCall" key={call.id}
        open={expanded[call.id] ?? expandNew}
        onToggle={event => {
          const open = event.currentTarget.open
          setExpanded(current => current[call.id] === open ? current : { ...current, [call.id]: open })
        }}>
        <summary>
          <span className={`taskStatusDot ${call.status}`} aria-hidden="true" />
          <span className="toolCallName">{call.name || '未命名工具'}</span>
          <span className="toolCallStatus">{STATUS_LABELS[call.status] || '状态未知'}</span>
          <span className="toolCallDuration">{Number.isFinite(call.durationMs) ? `${(Math.max(0, call.durationMs) / 1000).toFixed(1)} 秒` : '耗时待定'}</span>
        </summary>
        <div className="toolCallBody">
          <JsonBlock label="入参" value={call.arguments} />
          {call.output !== undefined && <JsonBlock label="输出" value={call.output} />}
          {call.error !== undefined && <JsonBlock label="错误" value={call.error} />}
          {call.output === undefined && call.error === undefined && <p className="toolCallPending">{call.status === 'running' ? '等待工具返回结果…' : '未提供输出'}</p>}
        </div>
      </details>)}
    </div>
  </section>
}
