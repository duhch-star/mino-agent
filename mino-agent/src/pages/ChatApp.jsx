import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useChatStore, useAuthStore } from '../store.js'
import ResumePanel from '../components/ResumePanel.jsx'
import Composer from '../components/Composer.jsx'
import { Markdown } from '../components/Markdown.jsx'
import { XiaominMark } from '../components/XiaominMark.jsx'
import { IconBranch, IconCheck, IconCopy, IconThumbDown, IconThumbUp } from '../components/Icons.jsx'
import GenUI from '../components/GenUI.jsx'
import ThinkingIndicator from '../components/ThinkingIndicator.jsx'
import ToolCalls from '../components/ToolCalls.jsx'
import '../styles/chat-ux.css'

const WIDTH_KEY = 'mino.resume-panel-width'
const clampWidth = (value, available) => Math.round(Math.max(320, Math.min(value, 880, Math.max(320, available - 370))))
function savedWidth() {
  try { const value = Number(localStorage.getItem(WIDTH_KEY)); return Number.isFinite(value) && value >= 320 ? Math.min(880, value) : 520 } catch { return 520 }
}

const TOOL_LABELS = {
  resume_analysis: '分析简历',
  job_description: '分析岗位描述',
  knowledge_search: '检索知识库',
  star_stories: '整理 STAR 案例',
}

function AssistantMessage({ message, sessionId, setFeedback, branchConversation, retryMessage, editMessageForResend, busy }) {
  const [copied, setCopied] = useState(false)
  const [recoveryError, setRecoveryError] = useState('')
  const [recovering, setRecovering] = useState(false)
  const recover = async action => {
    if (busy || recovering || !action) return
    setRecoveryError(''); setRecovering(true)
    try {
      await action(sessionId, message.id)
      if (action === editMessageForResend) requestAnimationFrame(() => document.querySelector('.chatWorkspace .composerInput')?.focus())
    } catch (error) { setRecoveryError(error.message || '操作失败，请重试。') }
    finally { setRecovering(false) }
  }
  const failed = message.error || message.task?.status === 'failed'
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
      <ToolCalls toolCalls={message.toolCalls} />
      {failed && <div className="chatFailureRecovery">
        <p className="chatGenerationError" role="alert">{message.requestRejected ? '请求未通过校验，请根据下方原因调整后重新发送。' : `${message.task?.label || '生成失败'}，回复可能不完整，请重试。`}</p>
        <div className="chatRecoveryActions"><button className="btn outline sm" disabled={busy || recovering || !retryMessage} onClick={() => recover(retryMessage)}>重试</button><button className="btn ghost sm" disabled={busy || recovering || !editMessageForResend} onClick={() => recover(editMessageForResend)}>编辑后重发</button><span>编辑会将原问题放回输入框，不会立即发送。</span></div>
        {recoveryError && <p className="chatGenerationError" role="alert">{recoveryError}</p>}
      </div>}
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
export default function ChatApp({ resume = false }) {
  const activeId = useChatStore(s => s.activeId)
  const conversations = useChatStore(s => s.conversations)
  const running = useChatStore(s => s.running)
  const runningSessionId = useChatStore(s => s.runningSessionId)
  const retryMessage = useChatStore(s => s.retryMessage)
  const editMessageForResend = useChatStore(s => s.editMessageForResend)
  const sessionRunning = !!running && (!runningSessionId || runningSessionId === activeId)
  const setFeedback = useChatStore(s => s.setMessageFeedback)
  const branchConversation = useChatStore(s => s.branchConversation)
  const messages = conversations[activeId] || []
  const scrollRef = useRef(null)
  const user = useAuthStore(s => s.user)
  const ensureBackendSession = useChatStore(s => s.ensureBackendSession)
  const newSession = useChatStore(s => s.newSession)
  const [resumeOpen, setResumeOpen] = useState(resume)
  const [resumeMode, setResumeMode] = useState(resume)
  const [sessionError, setSessionError] = useState('')
  const [layout, setLayout] = useState('split')
  const [mobileView, setMobileView] = useState('chat')
  const [panelWidth, setPanelWidth] = useState(savedWidth)
  const [availableWidth, setAvailableWidth] = useState(1200)
  const workspaceRef = useRef(null)
  const followRef = useRef(true)
  const lastScrollTop = useRef(0)
  const [awayFromBottom, setAwayFromBottom] = useState(false)
  const [hasNewContent, setHasNewContent] = useState(false)
  const dragRef = useRef(null)
  const effectiveWidth = clampWidth(panelWidth, availableWidth)
  const closeResume = () => { setResumeOpen(false); setLayout('split'); setMobileView('chat') }
  const jumpToBottom = () => {
    const el = scrollRef.current
    if (el) { el.scrollTop = el.scrollHeight; lastScrollTop.current = el.scrollTop }
    followRef.current = true; setAwayFromBottom(false); setHasNewContent(false)
  }
  const onChatScroll = () => {
    const el = scrollRef.current
    if (!el) return
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight
    const movingUp = el.scrollTop < lastScrollTop.current - 1
    const nearBottom = !movingUp && distance < 88
    lastScrollTop.current = el.scrollTop
    followRef.current = nearBottom
    setAwayFromBottom(!nearBottom)
    if (nearBottom) setHasNewContent(false)
  }
  useEffect(() => { setResumeOpen(resume); setResumeMode(resume); setLayout('split'); setMobileView('chat') }, [resume])
  useEffect(() => {
    const el = workspaceRef.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => setAvailableWidth(entry.contentRect.width))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  useEffect(() => { try { localStorage.setItem(WIDTH_KEY, String(panelWidth)) } catch { /* Private browsing may disable storage. */ } }, [panelWidth])
  useLayoutEffect(() => { followRef.current = true; setHasNewContent(false); setAwayFromBottom(false); if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight }, [activeId])
  useEffect(() => {
    let cancelled = false
    setSessionError('')
    if (resumeOpen && user && !activeId?.startsWith('conv_')) {
      ensureBackendSession(activeId).catch(error => { if (!cancelled) setSessionError(error.message) })
    }
    return () => { cancelled = true }
  }, [activeId, resumeOpen, user, ensureBackendSession])
  const changeMode = mode => { setResumeMode(resume || mode === 'resume'); if (resume || mode === 'resume') { setResumeOpen(true); setLayout('split') } }
  const startResume = () => { if (running) return; newSession(); setResumeMode(true); setResumeOpen(true); setLayout('split'); setMobileView('chat') }
  const lastUserOptions = [...messages].reverse().find(m => m.role === 'user')?.options || null

  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) return
    if (followRef.current) el.scrollTop = el.scrollHeight
    else setHasNewContent(true)
  }, [messages, sessionRunning])
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const observer = new ResizeObserver(() => { if (followRef.current) el.scrollTop = el.scrollHeight })
    observer.observe(el)
    if (el.firstElementChild) observer.observe(el.firstElementChild)
    return () => observer.disconnect()
  }, [activeId, messages.length === 0])
  const resizeKey = event => {
    let next
    if (event.key === 'ArrowLeft') next = effectiveWidth + (event.shiftKey ? 64 : 16)
    if (event.key === 'ArrowRight') next = effectiveWidth - (event.shiftKey ? 64 : 16)
    if (event.key === 'Home') next = 320
    if (event.key === 'End') next = availableWidth - 370
    if (next !== undefined) { event.preventDefault(); setPanelWidth(clampWidth(next, availableWidth)) }
  }
  const resizeStart = event => {
    if (event.button !== 0) return
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = { x: event.clientX, width: effectiveWidth }
  }
  const resizeMove = event => { if (dragRef.current) setPanelWidth(clampWidth(dragRef.current.width + dragRef.current.x - event.clientX, availableWidth)) }

  return (
    <div ref={workspaceRef} className={`chatWorkspace chatUxWorkspace${resumeOpen ? ' withResumePanel' : ''} layout-${layout} mobile-${mobileView}`} style={{ '--resume-panel-width': `${effectiveWidth}px` }}>
      <header className="chatWorkspaceToolbar"><span>{resumeMode ? '简历工作流 · 共用聊天' : 'MINO AGENT'}</span><div>
        <button className="btn ghost sm" aria-expanded={resumeOpen} onClick={() => { if (resumeOpen) closeResume(); else { setResumeOpen(true); setResumeMode(true); setLayout('split') } }}>{resumeOpen ? '收起简历栏' : '打开简历栏'}</button>
        {resumeOpen && <><div className="workspaceLayoutModes" role="group" aria-label="工作区布局">{[['chat', '专注聊天'], ['split', '并排'], ['preview', '放大预览']].map(([id, label]) => <button key={id} className="btn ghost sm" aria-pressed={layout === id} onClick={() => setLayout(id)}>{label}</button>)}</div><div className="workspaceMobileViews" role="group" aria-label="切换聊天和简历"><button className="btn ghost sm" aria-pressed={mobileView === 'chat'} onClick={() => setMobileView('chat')}>聊天 / 输入</button><button className="btn ghost sm" aria-pressed={mobileView === 'resume'} onClick={() => setMobileView('resume')}>简历</button></div></>}
        <button className="btn outline sm" disabled={running} onClick={startResume}>开始简历会话</button>
      </div></header>
      <div className="chatWorkspaceBody">
      <div className="chatWorkspaceMain" id="workspace-chat">
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
          <Composer resumeMode={resumeMode} onModeChange={changeMode} />
        </main>
      ) : (
        <>
          <div className="chatScrollArea">
          <div className="chatScroll" ref={scrollRef} onScroll={onChatScroll} tabIndex={0} aria-label="对话消息">
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
                  <AssistantMessage message={m} sessionId={activeId} setFeedback={setFeedback} branchConversation={branchConversation} retryMessage={retryMessage} editMessageForResend={editMessageForResend} busy={!!running} />
                </div>
              ))}
              {sessionRunning && (
                <ThinkingIndicator
                  tool={TOOL_LABELS[lastUserOptions?.tool] || null}
                />
              )}
            </div>
          </div>
          {awayFromBottom && <button className="chatJumpBottom btn outline sm" onClick={jumpToBottom}>{hasNewContent ? '有新内容 · 回到底部 ↓' : '回到底部 ↓'}</button>}
          </div>
          <Composer resumeMode={resumeMode} onModeChange={changeMode} />
        </>
      )}
    </div>
      </div>
      {resumeOpen && <><div className="resumeResizeHandle" role="separator" tabIndex={0} aria-label="调整简历栏宽度，左右方向键调整" aria-orientation="vertical" aria-controls="workspace-resume" aria-valuemin={320} aria-valuemax={clampWidth(880, availableWidth)} aria-valuenow={effectiveWidth} onKeyDown={resizeKey} onPointerDown={resizeStart} onPointerMove={resizeMove} onPointerUp={() => { dragRef.current = null }} onPointerCancel={() => { dragRef.current = null }} onLostPointerCapture={() => { dragRef.current = null }} /><div className="resumePanelContainer" id="workspace-resume">
        {user && activeId?.startsWith('conv_') ? <ResumePanel key={activeId} conversationId={activeId} messages={messages} running={sessionRunning} onClose={closeResume}/> : <aside className="resumeWorkspacePanel"><header className="resumeWorkspaceHeader"><h2>我的简历</h2><button className="btn ghost sm" onClick={closeResume}>关闭 ×</button></header><p className="resumeWorkspaceGuide">{sessionError || (user ? '正在准备本会话简历…' : '请先登录，再通过同一个聊天输入框填写真实信息，简历将保存在当前会话中。')}</p></aside>}
      </div></>}
      </div>
    </div>
  )
}
