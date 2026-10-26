import { useEffect, useRef, useState } from 'react'
import { useChatStore } from '../store.js'
import { fetchChatTools } from '../api.js'
import { IconChevronDown, IconSend } from './Icons.jsx'

const MODES = [
  { id: 'career', label: '求职咨询' },
  { id: 'resume', label: '简历优化' },
  { id: 'interview', label: '面试练习' },
]

// 内置工具 fallback：服务端目录不可用时的兜底（与后端 TOOLS 注册表保持同名）
const FALLBACK_TOOLS = [
  { id: 'resume_analysis', label: '分析简历' },
  { id: 'job_description', label: '分析岗位描述' },
  { id: 'knowledge_search', label: '检索知识库' },
  { id: 'star_stories', label: '整理 STAR 案例' },
]

const ACCEPTED_FILES = '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.md,.csv,.json,.rtf,.html,.htm'

export default function Composer({ resumeMode = false, onModeChange }) {
  const sendMessage = useChatStore(s => s.sendMessage)
  const running = useChatStore(s => s.running)
  const activeId = useChatStore(s => s.activeId)
  const drafts = useChatStore(s => s.drafts)
  const setDraft = useChatStore(s => s.setDraft)
  const stopGeneration = useChatStore(s => s.stopGeneration)
  const context = useChatStore(s => s.context)
  const clearContext = useChatStore(s => s.clearContext)
  const draft = drafts[activeId] || {}
  const value = draft.text || ''
  const mode = draft.mode || 'career'
  const depth = draft.depth || 'standard'
  const tool = draft.tool || ''
  const files = draft.attachments || []
  const setValue = text => setDraft(activeId, { text })
  const setMode = mode => setDraft(activeId, { mode })
  const setDepth = depth => setDraft(activeId, { depth })
  const setTool = value => setDraft(activeId, { tool: typeof value === 'function' ? value(tool) : value })
  const setFiles = value => {
    const next = typeof value === 'function' ? value(files) : value
    setDraft(activeId, { attachments: next, attachmentIds: next.filter(file => file.id).map(file => file.id) })
  }
  const [menu, setMenu] = useState('')
  const [sending, setSending] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [tools, setTools] = useState(FALLBACK_TOOLS)
  const ref = useRef(null)
  const fileRef = useRef(null)
  const toolbarRef = useRef(null)
  const composing = useRef(false)
  const submitLock = useRef(false)

  // 动态加载工具目录（后端 /api/chat/tools；失败则维持内置 fallback）
  useEffect(() => {
    let alive = true
    fetchChatTools()
      .then(data => {
        if (alive && Array.isArray(data.tools) && data.tools.length) setTools(data.tools)
      })
      .catch(() => { /* 保持 fallback */ })
    return () => { alive = false }
  }, [])

  useEffect(() => {
    const closeMenus = (event) => {
      if (!toolbarRef.current?.contains(event.target)) setMenu('')
    }
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setMenu('')
    }
    document.addEventListener('pointerdown', closeMenus)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeMenus)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [])

  const submit = async () => {
    if ((!value.trim() && !files.length && !context) || running || submitLock.current) return
    submitLock.current = true
    setSending(true)
    setSubmitError('')
    try {
      const result = await sendMessage(value, { sessionId: activeId, mode: resumeMode ? 'resume' : mode, depth, tool, attachments: files, attachmentIds: draft.attachmentIds || [], context, draftRevision: draft.revision || 0 })
      if (result?.error) { setSubmitError(result.error.message || '发送失败，请重试'); return }
      ref.current?.focus()
    } catch (error) {
      setSubmitError(error.message || '文件上传失败，请重试')
    } finally {
      submitLock.current = false
      setSending(false)
    }
  }

  const onKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey && !composing.current && !event.nativeEvent?.isComposing && event.keyCode !== 229) {
      event.preventDefault()
      submit()
    }
  }

  const addFiles = (event) => {
    const selected = Array.from(event.target.files || [])
    setFiles(current => [...current, ...selected].filter((file, index, all) =>
      all.findIndex(item => `${item.name}:${item.size}:${item.lastModified}` === `${file.name}:${file.size}:${file.lastModified}`) === index,
    ))
    event.target.value = ''
  }

  const toggleMenu = (name) => setMenu(current => current === name ? '' : name)
  const canSend = Boolean(value.trim() || files.length || context)

  return (
    <div className="composerWrap">
      <div className="composerCard">
        {(context || files.length > 0) && (
          <div className="composerAttachments">
            {context && (
              <div className="contextChip">
                <span>就《{context.title}》段落提问</span>
                <button onClick={clearContext} aria-label="移除引用内容">×</button>
              </div>
            )}
            {files.map((file, index) => (
              <div className="contextChip fileChip" key={`${file.name}:${file.lastModified}`}>
                <span title={`${file.name}`}>{file.name}</span>
                <button onClick={() => setFiles(current => current.filter((_, i) => i !== index))} aria-label={`移除${file.name}`}>×</button>
              </div>
            ))}
          </div>
        )}
        <textarea
          ref={ref}
          className="composerInput"
          placeholder={resumeMode ? '填写真实经历或提出简历修改要求…（Enter 发送，Shift+Enter 换行）' : '向 MINO AGENT 提问，或聊聊你的求职问题…（Enter 发送，Shift+Enter 换行）'}
          rows={2}
          value={value}
          onChange={event => setValue(event.target.value)}
          onKeyDown={onKeyDown}
          onCompositionStart={() => { composing.current = true }}
          onCompositionEnd={() => { composing.current = false }}
        />
        <div className="composerToolbar" ref={toolbarRef}>
          <div className="composerControls">
            <input ref={fileRef} className="visuallyHidden" type="file" accept={ACCEPTED_FILES} multiple onChange={addFiles} />
            <button className="composerControl" onClick={() => fileRef.current?.click()} title="添加简历或岗位文件" aria-label="添加文件">
              <span aria-hidden="true">＋</span><span>添加文件</span>
            </button>
            <div className="composerMenuWrap">
              <button className="composerControl" aria-expanded={menu === 'mode'} onClick={() => toggleMenu('mode')}>
                {MODES.find(item => item.id === (resumeMode ? 'resume' : mode))?.label}<IconChevronDown size={13} />
              </button>
              {menu === 'mode' && <div className="composerMenu" role="menu" aria-label="求职模式">
                {MODES.map(item => <button role="menuitemradio" aria-checked={(resumeMode ? 'resume' : mode) === item.id} className={(resumeMode ? 'resume' : mode) === item.id ? 'selected' : ''} key={item.id} onClick={() => { setMode(item.id); onModeChange?.(item.id); setMenu('') }}>{item.label}</button>)}
              </div>}
            </div>
            <div className="composerMenuWrap">
              <button className="composerControl" aria-expanded={menu === 'tool'} onClick={() => toggleMenu('tool')}>
                {tool ? tools.find(item => item.id === tool)?.label || tool : '工具'}<IconChevronDown size={13} />
              </button>
              {menu === 'tool' && <div className="composerMenu" role="menu" aria-label="求职工具">
                {tools.map(item => <button role="menuitemradio" aria-checked={tool === item.id} className={tool === item.id ? 'selected' : ''} key={item.id} onClick={() => { setTool(current => current === item.id ? '' : item.id); setMenu('') }}>{item.label}</button>)}
                {tool && <button className="composerMenuClear" onClick={() => { setTool(''); setMenu('') }}>清除工具</button>}
              </div>}
            </div>
            <div className="composerMenuWrap">
              <button className="composerControl" aria-expanded={menu === 'depth'} onClick={() => toggleMenu('depth')}>
                {depth === 'standard' ? '标准回答' : '深入分析'}<IconChevronDown size={13} />
              </button>
              {menu === 'depth' && <div className="composerMenu" role="menu" aria-label="回答档位">
                {[['standard', '标准回答'], ['deep', '深入分析']].map(([id, label]) => <button role="menuitemradio" aria-checked={depth === id} className={depth === id ? 'selected' : ''} key={id} onClick={() => { setDepth(id); setMenu('') }}>{label}</button>)}
              </div>}
            </div>
          </div>
          <button className="sendBtn" onClick={running ? () => stopGeneration() : submit} disabled={!running && (!canSend || sending)}>
            <IconSend size={14} />{running ? '停止生成' : sending ? '发送中' : '发送'}
          </button>
        </div>
      </div>
      {submitError && <div className="composerError" role="alert">{submitError}</div>}
      <div className="composerFootnote">文件工具 Harness：登录后可让 AI 在独立工作区列目录、读取、新建、修改与搜索文本；每次真实调用的入参与输出可展开查看，不开放电脑任意文件访问。</div>
      <div className="composerFootnote">支持 PDF、Word（doc/docx）、Excel（xls/xlsx）、PPT、TXT、Markdown、CSV、JSON、RTF、HTML；上传的附件由服务端本地解析，回答会针对附件内容逐条优化</div>
    </div>
  )
}
