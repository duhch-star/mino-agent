import { useEffect, useRef } from 'react'
import { useChatStore } from '../store.js'
import Composer from '../components/Composer.jsx'
import { Markdown } from '../components/Markdown.jsx'

// 对话助手（通用 AI 问答，复用原 DeepSeek 聊天视图）
export default function ChatApp() {
  const activeId = useChatStore(s => s.activeId)
  const conversations = useChatStore(s => s.conversations)
  const running = useChatStore(s => s.running)
  const messages = conversations[activeId] || []
  const scrollRef = useRef(null)

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, running])

  return (
    <div className="chatRoot">
      <div className="chatScroll" ref={scrollRef}>
        <div className="chatColumn">
          {messages.map(m => m.role === 'user' ? (
            <div key={m.id} className="userRow">
              <div className="userBubble">{m.content}</div>
            </div>
          ) : (
            <div key={m.id} className="assistantRoot">
              <Markdown text={m.content} />
            </div>
          ))}
          {running && (
            <div className="running">
              <span className="runningDot" />
              正在思考…
            </div>
          )}
        </div>
      </div>
      <Composer />
    </div>
  )
}
