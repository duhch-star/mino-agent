import { useEffect, useRef, useState } from 'react'
import { useChatStore } from '../store.js'
import Composer from '../components/Composer.jsx'
import { Markdown } from '../components/Markdown.jsx'
import { XiaominMark } from '../components/XiaominMark.jsx'
import { IconBranch, IconCheck, IconCopy, IconThumbDown, IconThumbUp } from '../components/Icons.jsx'
import GenUI from '../components/GenUI.jsx'
import ThinkingIndicator from '../components/ThinkingIndicator.jsx'

const MODE_LABELS = { career: '求职咨询', resume: '简历优化', interview: '面试练习' }
const TOOL_LABELS = {
  resume_analysis: '分析简历',
  job_description: '分析岗位描述',
  knowledge_search: '检索知识库',
  star_stories: '整理 STAR 案例',
}

function AssistantMessage({ message, sessionId, setFeedback, branchConversation }) {
  const [copied, setCopied] = useState(false)
  const references = message.references || []
  const copyReply = async () => {
    try {
      await navigator.clipboard.writeText(message.content)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopied(false)
    }
  }
  const metrics = []
  if (Number.isFinite(message.usage?.inputTokens)) metrics.push(`输入 ${message.usage.inputTokens} tok`)
  if (Number.isFinite(message.usage?.outputTokens)) metrics.push(`输出 ${message.usage.outputTokens} tok`)
  if (Number.isFinite(message.performance?.durationMs)) metrics.push(`${(message.performance.durationMs / 1000).toFixed(1)} 秒`)
  if (Number.isFinite(message.performance?.tokensPerSecond)) metrics.push(`${message.performance.tokensPerSecond} tok/s`)

  return (
    <div className="assistantRoot">
      {message.task && <details className="taskTrace" open={message.task.status === 'running'}>
        <summary>
          <span className={`taskStatusDot ${message.task.status || 'completed'}`} />
          本轮任务 · {message.task.label || (message.task.status === 'running' ? '正在生成回答' : message.task.status === 'failed' ? '生成失败' : '回答已生成')}
        </summary>
        <div className="taskTraceBody">
          <div><span>模式</span><strong>{MODE_LABELS[message.task.mode] || '求职咨询'}</strong></div>
          <div><span>工具</span><strong>{TOOL_LABELS[message.task.tool] || '未选择'}</strong></div>
          <div><span>回答档位</span><strong>{message.task.depth === 'deep' ? '深入分析' : '标准回答'}</strong></div>
          {(message.task.skills || []).length > 0 && <div><span>技能</span><strong>{(message.task.skills || []).map(s => s.name).join('、')}</strong></div>}
          {references.map((reference, index) => <div key={`${reference.kind}:${reference.title}:${index}`}><span>{reference.kind === 'knowledge' ? '知识库章节' : '附件状态'}</span><strong>{reference.kind === 'knowledge' ? reference.title : `${reference.title}（${reference.status === 'ready' ? '已上传' : '上传失败'}）`}</strong></div>)}
        </div>
      </details>}
      <Markdown text={message.content} />
      {message.ui && <GenUI ui={message.ui} />}
      {references.length > 0 && <div className="answerReferences" aria-label="本轮关联材料">
        <span className="answerMetaLabel">本轮材料</span>
        {references.map((reference, index) => <span className="answerReference" key={`${reference.kind}:${reference.title}:${index}`}>
          {reference.kind === 'knowledge' ? '知识库章节' : reference.status === 'ready' ? '已上传附件' : '上传失败'} · {reference.title}
        </span>)}
      </div>}
      {message.content && <div className="chatAnswerFooter">
        <div className="chatAnswerActions">
          <button className="chatAnswerAction" onClick={copyReply} aria-label={copied ? '已复制回答' : '复制回答'} title={copied ? '已复制' : '复制'}>
            {copied ? <IconCheck /> : <IconCopy />}
          </button>
          <button className={`chatAnswerAction ${message.feedback === 'helpful' ? 'active' : ''}`} onClick={() => setFeedback(sessionId, message.id, 'helpful')} aria-label="回答有帮助" aria-pressed={message.feedback === 'helpful'} title="有帮助">
            <IconThumbUp />
          </button>
          <button className={`chatAnswerAction ${message.feedback === 'unhelpful' ? 'active' : ''}`} onClick={() => setFeedback(sessionId, message.id, 'unhelpful')} aria-label="回答没帮助" aria-pressed={message.feedback === 'unhelpful'} title="没帮助">
            <IconThumbDown />
          </button>
          {message.task?.status !== 'running' && <button className="chatAnswerAction" onClick={() => branchConversation(sessionId, message.id)} aria-label="从此回答分支继续" title="分支继续">
            <IconBranch />
          </button>}
          {message.feedback && <span className="feedbackSaved">已记录本地反馈</span>}
        </div>
        {metrics.length > 0 && <div className="chatAnswerMetrics" aria-label="回答用量与耗时">{metrics.join(' · ')}</div>}
      </div>}
    </div>
  )
}

// 对话助手（通用 AI 问答，复用原 DeepSeek 聊天视图）
export default function ChatApp() {
  const activeId = useChatStore(s => s.activeId)
  const conversations = useChatStore(s => s.conversations)
  const running = useChatStore(s => s.running)
  const setFeedback = useChatStore(s => s.setMessageFeedback)
  const branchConversation = useChatStore(s => s.branchConversation)
  const messages = conversations[activeId] || []
  const scrollRef = useRef(null)
  const lastUserOptions = [...messages].reverse().find(m => m.role === 'user')?.options || null

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, running])

  return (
    <div className={`chatRoot${messages.length === 0 ? ' chatRootEmpty' : ''}`}>
      {messages.length === 0 ? (
        <main className="emptyChatStage">
          <div className="emptyGreeting">
            <XiaominMark size={28} className="emptyGreetingMark" />
            <div>
              <h1>你好，我是 MINO AGENT</h1>
              <p>今天想先从哪件求职任务开始？</p>
            </div>
          </div>
          <Composer />
        </main>
      ) : (
        <>
          <div className="chatScroll" ref={scrollRef}>
            <div className="chatColumn">
              {messages.map(m => m.role === 'user' ? (
                <div key={m.id} className="userRow">
                  <div className="userBubble">
                    {m.attachments?.length > 0 && <div className="messageAttachments">{m.attachments.map(file => <span key={`${file.name}:${file.lastModified}`}>{file.name}</span>)}</div>}
                    {m.content}
                  </div>
                </div>
              ) : (
                <div key={m.id} className="assistantRoot">
                  <AssistantMessage message={m} sessionId={activeId} setFeedback={setFeedback} branchConversation={branchConversation} />
                </div>
              ))}
              {running && (
                <ThinkingIndicator
                  tool={TOOL_LABELS[lastUserOptions?.tool] || null}
                />
              )}
            </div>
          </div>
          <Composer />
        </>
      )}
    </div>
  )
}
