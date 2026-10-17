import { useRef, useState } from 'react'
import { useChatStore } from '../store.js'
import { IconChevronDown, IconSend } from './Icons.jsx'

export default function Composer() {
  const sendMessage = useChatStore(s => s.sendMessage)
  const running = useChatStore(s => s.running)
  const context = useChatStore(s => s.context)
  const clearContext = useChatStore(s => s.clearContext)
  const [value, setValue] = useState('')
  const ref = useRef(null)

  const submit = () => {
    if (!value.trim() || running) return
    sendMessage(value)
    setValue('')
    ref.current?.focus()
  }

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  return (
    <div className="composerWrap">
      <div className="composerCard">
        {context && (
          <div className="contextChip">
            <span>就《{context.title}》段落提问</span>
            <button onClick={clearContext} aria-label="取消">×</button>
          </div>
        )}
        <textarea
          ref={ref}
          className="composerInput"
          placeholder="向 MINO AGENT 提问，或聊聊你的求职问题…（Enter 发送，Shift+Enter 换行）"
          rows={2}
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={onKeyDown}
        />
        <div className="composerToolbar">
          <button className="modelHint">
            MINO AGENT <IconChevronDown size={14} />
          </button>
          <button className="sendBtn" onClick={submit} disabled={!value.trim() || running}>
            <IconSend size={14} />
            发送
          </button>
        </div>
      </div>
    </div>
  )
}
