import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { positions, difficulties, durations, questionBank } from './data/interview.js'
import { streamChatMessage, fetchInterviewFeedback, backendLogin, createBackendChatSession, fetchBackendChatSessions, fetchBackendChatMessages, renameBackendChatSession, deleteBackendChatSession, uploadChatAttachments, fetchQuestions, apiLogout, deleteCurrentUserData, saveLearningState, fetchLearningState, fetchCurrentUser, hasAuthTokens, AUTH_EXPIRED_EVENT } from './api.js'

// ---------------------------------------------------------------------------
// UI：主题 / 侧边栏 / 设置 / 字号
// ---------------------------------------------------------------------------
export const useUiStore = create(persist((set) => ({
  dark: false,
  sidebarCollapsed: false,
  settingsOpen: false,
  fontSize: 14,
  toggleDark: () => set(s => ({ dark: !s.dark })),
  toggleSidebar: () => set(s => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  openSettings: () => set({ settingsOpen: true }),
  closeSettings: () => set({ settingsOpen: false }),
  setFontSize: (n) => set({ fontSize: n }),
}), { name: 'xiao-ui', partialize: (s) => ({ dark: s.dark, fontSize: s.fontSize }) }))

// ---------------------------------------------------------------------------
// 对话助手（复用原 DeepSeek 聊天外壳）
// ---------------------------------------------------------------------------
let chatIdSeq = 100
const backendSessionPromises = new Map()
let accountEpoch = 0
let generation = null
let accountNamespace = 'guest'
// Legacy unscoped caches are deliberately not imported into authenticated accounts.
const accountStorage = {
  getItem: name => { try { return JSON.parse(localStorage.getItem(`${name}:${accountNamespace}`) || 'null') } catch { return null } },
  setItem: (name, value) => localStorage.setItem(`${name}:${accountNamespace}`, JSON.stringify(value)),
  removeItem: name => localStorage.removeItem(`${name}:${accountNamespace}`),
}
const emptyLearning = () => ({ profile: { direction: '', level: '' }, bookmarks: [], progress: {}, notes: {}, quizResults: {} })
const emptyChat = () => ({ sessions: [], conversations: {}, activeId: null, drafts: {}, context: null, running: false, runningSessionId: null })
const draftValue = () => ({ text: '', attachments: [], attachmentIds: [], context: null, mode: 'career', depth: 'standard', tool: '', revision: 0 })

// SSE 结束或页面恢复后，不让未收到终态的调用一直显示“运行中”。
function finishRunningToolCalls(toolCalls, reason = '调用已中断，未收到完成结果') {
  return (Array.isArray(toolCalls) ? toolCalls : []).map(call => {
    if (call.status !== 'running') return call
    const startedAt = Date.parse(call.startedAt)
    return {
      ...call,
      status: 'failed',
      error: reason,
      durationMs: Number.isFinite(call.durationMs) ? call.durationMs : Number.isFinite(startedAt) ? Math.max(0, Date.now() - startedAt) : undefined,
    }
  })
}

function originalRequest(list, index) {
  const message = list[index]
  if (message?.request) return message.request
  const user = message?.role === 'user' ? message : list.slice(0, index).findLast(item => item.role === 'user')
  if (!user || user.attachmentIds == null && user.context == null) return null
  return { text: user.content || '请结合附件进行分析', draftText: user.content || '', context: user.context || {}, attachments: user.attachments || [], attachmentIds: user.attachmentIds || [], mode: user.options?.mode || user.mode || 'career', depth: user.options?.depth || user.depth || 'standard', tool: user.options?.tool || user.tool || null }
}
function restoreChatMessage(message) {
  return {
    ...message,
    toolCalls: finishRunningToolCalls(message.toolCalls),
    ...(message.task?.status === 'running' ? { task: { ...message.task, status: 'failed', label: '生成已中断' } } : {}),
  }
}

const seedSessions = [
  { id: 's1', title: '求职方向怎么定？' },
  { id: 's2', title: '简历优化建议' },
  { id: 's3', title: '模拟面试复盘' },
]

const seedMessages = [
  { id: 'm1', role: 'user', content: '我是一名应届生，想做产品经理，但不知道从哪开始准备？' },
  {
    id: 'm2',
    role: 'assistant',
    content: '可以从**三条线**并行准备：\n\n- **知识**：先学 [[面试官如何评价 STAR 回答]] 与 [[简历撰写]]\n- **作品**：整理 2~3 个能讲清楚「我做了什么」的项目\n- **面试**：用「AI 面试」做几轮模拟，练表达\n\n需要我先帮你梳理学习路径吗？',
  },
]

export const useChatStore = create(persist((set, get) => ({
  sessions: seedSessions,
  activeId: 's1',
  conversations: { s1: seedMessages, s2: [], s3: [] },
  running: false,
  runningSessionId: null,
  drafts: {},
  getDraft: id => get().drafts[id] || draftValue(),
  setDraft: (id, patch) => set(state => ({ drafts: { ...state.drafts, [id]: { ...(state.drafts[id] || draftValue()), ...patch, revision: (state.drafts[id]?.revision || 0) + 1 } } })),
  context: null, // 就地追问上下文 { title, snippet }

  hydrateSessions: async () => {
    const epoch = accountEpoch
    const { items = [] } = await fetchBackendChatSessions()
    const conversations = {}
    await Promise.all(items.map(async session => {
      const result = await fetchBackendChatMessages(session.id)
      conversations[session.id] = (result.items || []).map(restoreChatMessage)
    }))
    if (epoch !== accountEpoch) return
    set({
      sessions: items.map(item => ({ id: item.id, title: item.title, parentId: item.parentId, branchMessageId: item.branchMessageId })),
      conversations,
      activeId: items.some(item => item.id === get().activeId) ? get().activeId : items[0]?.id || null,
    })
  },

  newSession: () => {
    const id = `s${Date.now()}-${++chatIdSeq}`
    set(s => ({
      sessions: [{ id, title: '新对话' }, ...s.sessions],
      conversations: { ...s.conversations, [id]: [] },
      activeId: id,
      context: null,
    }))
  },

  // 同一临时会话只创建一次；请求完成时不抢回用户已经切换的会话。
  ensureBackendSession: async (sessionId = get().activeId) => {
    if (sessionId?.startsWith('conv_')) return sessionId
    if (backendSessionPromises.has(sessionId)) return backendSessionPromises.get(sessionId)
    const pending = (async () => {
      const epoch = accountEpoch
      const current = get().sessions.find(session => session.id === sessionId)
      const created = await createBackendChatSession({ title: current?.title || '新对话' })
      if (epoch !== accountEpoch) throw new Error('账号状态已变化')
      set(state => {
        if (sessionId && !state.sessions.some(session => session.id === sessionId)) return state
        const conversations = { ...state.conversations, [created.id]: state.conversations[sessionId] || [] }
        delete conversations[sessionId]
        return {
          conversations,
          drafts: { ...state.drafts, [created.id]: state.drafts[sessionId] || draftValue() },
          runningSessionId: state.runningSessionId === sessionId ? created.id : state.runningSessionId,
          sessions: sessionId ? state.sessions.map(session => session.id === sessionId ? { ...session, id: created.id } : session) : [{ id: created.id, title: '新对话' }, ...state.sessions],
          activeId: state.activeId === sessionId ? created.id : state.activeId,
        }
      })
      return created.id
    })().finally(() => backendSessionPromises.delete(sessionId))
    backendSessionPromises.set(sessionId, pending)
    return pending
  },

  selectSession: (id) => set({ activeId: id, context: get().drafts[id]?.context || null }),

  renameSession: (id, title) => {
    const cleanTitle = title.trim()
    if (!cleanTitle) return
    if (id.startsWith('conv_')) renameBackendChatSession(id, cleanTitle).catch(error => console.error(error))
    set(state => ({ sessions: state.sessions.map(session => session.id === id ? { ...session, title: cleanTitle.slice(0, 48) } : session) }))
  },

  deleteSession: (id) => {
    if (generation && (generation.sessionId === id || get().runningSessionId === id)) { generation.controller.abort(); generation = null; set({ running: false, runningSessionId: null }) }
    const drafts = { ...get().drafts }; delete drafts[id]; set({ drafts })
    if (id.startsWith('conv_')) deleteBackendChatSession(id).catch(error => console.error(error))
    const state = get()
    const remainingSessions = state.sessions.filter(session => session.id !== id)
    const conversations = { ...state.conversations }
    delete conversations[id]
    if (!remainingSessions.length) {
      const fallbackId = `s${Date.now()}`
      set({ sessions: [{ id: fallbackId, title: '新对话' }], conversations: { ...conversations, [fallbackId]: [] }, activeId: fallbackId })
      return
    }
    set({
      sessions: remainingSessions,
      conversations,
      activeId: state.activeId === id ? remainingSessions[0].id : state.activeId,
    })
  },

  branchConversation: async (sessionId, messageId) => {
    const epoch = accountEpoch
    try {
      const parentSessionId = await get().ensureBackendSession(sessionId)
      const source = get().sessions.find(item => item.id === parentSessionId)
      const created = await createBackendChatSession({ title: `继续：${source?.title || '求职对话'}`, parentSessionId, branchMessageId: messageId })
      const result = await fetchBackendChatMessages(created.id)
      if (epoch !== accountEpoch) return { error: new Error('账号状态已变化') }
      set(state => ({ sessions: [{ ...created, parentId: parentSessionId, branchMessageId: messageId }, ...state.sessions], conversations: { ...state.conversations, [created.id]: (result.items || []).map(restoreChatMessage) }, activeId: created.id }))
      return created
    } catch (error) { return { error } }
  },

  setContext: (ctx) => { get().setDraft(get().activeId, { context: ctx }); set({ context: ctx }) },
  clearContext: () => { get().setDraft(get().activeId, { context: null }); set({ context: null }) },
  setMessageFeedback: (sessionId, messageId, feedback) => set(state => ({
    conversations: {
      ...state.conversations,
      [sessionId]: (state.conversations[sessionId] || []).map(message =>
        message.id === messageId ? { ...message, feedback: message.feedback === feedback ? null : feedback } : message,
      ),
    },
  })),

  stopGeneration: (sessionId) => {
    if (generation && (!sessionId || generation.sessionId === sessionId || get().runningSessionId === sessionId)) generation.controller.abort()
  },
  retryMessage: async (sessionId, assistantId) => {
    const list = get().conversations[sessionId] || []
    const request = originalRequest(list, list.findIndex(item => item.id === assistantId))
    if (!request) return { error: new Error('该消息没有可复用的请求，请编辑后重新发送') }
    return get().sendMessage(request.text, { request, sessionId, retryOf: assistantId })
  },
  editMessageForResend: (sessionId, messageId) => get().loadMessageDraft(sessionId, messageId),
  loadMessageDraft: (sessionId, messageId) => {
    const list = get().conversations[sessionId] || []
    const index = list.findIndex(item => item.id === messageId)
    const request = originalRequest(list, index)
    if (!request) return { error: new Error('该消息没有原始请求') }
    get().setDraft(sessionId, { text: request.draftText ?? request.text, context: request.context, attachments: (request.attachments || []).map((file, index) => ({ ...file, id: request.attachmentIds?.[index] })), attachmentIds: request.attachmentIds || [], mode: request.mode, depth: request.depth, tool: request.tool, editOf: messageId })
    set({ activeId: sessionId, context: request.context || null })
    return { sessionId }
  },
  sendMessage: async (text, options = {}) => {
    if (['expired', 'error', 'validating'].includes(useAuthStore.getState().status)) return { error: new Error('请先验证登录状态或明确选择游客模式') }
    if (generation) return { error: new Error('已有回复正在生成，请先停止') }
    const requestedSessionId = options.sessionId || get().activeId
    const clean = (text || '').trim()
    const context = options.request?.context || options.context || get().context
    const files = [...(options.attachments || [])]
    if (!clean && !files.length && !options.attachmentIds?.length && !context && !options.request) return { error: new Error('请输入消息或添加附件') }
    const controller = new AbortController()
    const epoch = accountEpoch
    const run = { controller, sessionId: requestedSessionId }
    generation = run
    const abort = () => controller.abort()
    options.signal?.addEventListener('abort', abort, { once: true })
    if (options.signal?.aborted) abort()
    set({ running: true, runningSessionId: requestedSessionId })
    let activeId, assistantId, userMessageId, acc = '', pendingUi
    const valid = () => epoch === accountEpoch && generation === run
    const check = () => { if (!valid() || controller.signal.aborted) throw new DOMException('回复已中断', 'AbortError') }
    const update = patch => { if (valid() && activeId && assistantId) set(state => ({ conversations: { ...state.conversations, [activeId]: (state.conversations[activeId] || []).map(m => m.id === assistantId ? { ...m, ...patch(m) } : m) } })) }
    // Snapshot before the first await: typing and session switches cannot mutate this request.
    const snapshot = options.request ? structuredClone(options.request) : { text: clean || (context ? '请结合引用内容进行分析' : '请结合附件进行分析'), draftText: text || '', context: context ? { ...context } : {}, mode: options.mode || 'career', depth: options.depth || 'standard', tool: options.tool || null, attachments: files.map(file => ({ name: file.name, type: file.type, size: file.size, lastModified: file.lastModified })), attachmentIds: [...(options.attachmentIds || [])] }
    try {
      activeId = await get().ensureBackendSession(requestedSessionId)
      run.sessionId = activeId
      check()
      set({ runningSessionId: activeId })
      const newFiles = files.filter(file => !file.id)
      if (!options.request && newFiles.length && snapshot.attachmentIds.length !== files.length) {
        const uploaded = await uploadChatAttachments(newFiles, controller.signal)
        check()
        const uploadedFiles = uploaded.files || []
        if (uploadedFiles.length !== newFiles.length) throw new Error('附件上传未完成，请重试')
        let uploadIndex = 0
        snapshot.attachmentIds = files.map(file => file.id || uploadedFiles[uploadIndex++].id)
        // Preserve uploaded IDs on a failed generation, avoiding duplicate uploads on resend.
        const draft = get().drafts[activeId]
        if (draft && draft.revision === options.draftRevision) set(state => ({ drafts: { ...state.drafts, [activeId]: { ...draft, attachments: draft.attachments.map((file, index) => { if (typeof File !== 'undefined' && file instanceof File) { Object.defineProperty(file, 'id', { value: snapshot.attachmentIds[index], configurable: true }); return file }; return { ...file, id: snapshot.attachmentIds[index] } }), attachmentIds: snapshot.attachmentIds } } }))
      }
      snapshot.conversationId = activeId
      assistantId = `a${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
      const references = [...(context?.title ? [{ kind: 'knowledge', title: context.title }] : []), ...snapshot.attachments.map(file => ({ kind: 'file', title: file.name, status: 'ready' }))]
      userMessageId = `u${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
      const task = { status: 'running', mode: snapshot.mode, depth: snapshot.depth, tool: snapshot.tool, ...(options.retryOf ? { label: '重试生成' } : {}) }
      set(state => ({ conversations: { ...state.conversations, [activeId]: [...(state.conversations[activeId] || []), ...(!options.retryOf ? [{ id: userMessageId, role: 'user', content: clean || snapshot.text, attachments: snapshot.attachments, references, options: { mode: snapshot.mode, depth: snapshot.depth, tool: snapshot.tool }, request: snapshot }] : []), { id: assistantId, role: 'assistant', content: '', toolCalls: [], references, task, request: snapshot, retryOf: options.retryOf || null, ...(options.retryOf ? { retryLabel: '重试生成' } : {}) }] }, sessions: state.sessions.map(item => item.id === activeId && item.title === '新对话' ? { ...item, title: (clean || files[0]?.name || '附件分析').slice(0, 24) } : item) }))
      const result = await streamChatMessage(snapshot, {
        signal: controller.signal,
        onToolCall: call => { if (call?.id) update(m => ({ toolCalls: (m.toolCalls || []).some(c => c.id === call.id) ? m.toolCalls.map(c => c.id === call.id ? { ...call } : c) : [...(m.toolCalls || []), { ...call }] })) },
        onActivity: activity => update(m => ({ task: { ...m.task, status: activity.status, label: activity.label } })),
        onChunk: chunk => { if (!controller.signal.aborted) { acc += chunk; update(() => ({ content: acc })) } },
        onUi: ui => { pendingUi = ui },
        onComplete: result => update(m => ({ toolCalls: finishRunningToolCalls(result.toolCalls || m.toolCalls), usage: result.usage, performance: result.performance, task: { ...m.task, status: 'completed', skills: result.skills || [] }, ui: result.ui || pendingUi })),
      })
      check()
      if (result.messageId || result.userMessageId) {
        const localAssistantId = assistantId
        set(state => ({ conversations: { ...state.conversations, [activeId]: (state.conversations[activeId] || []).map(message => message.id === localAssistantId && result.messageId ? { ...message, id: result.messageId } : message.id === userMessageId && result.userMessageId ? { ...message, id: result.userMessageId } : message) } }))
        assistantId = result.messageId || assistantId
      }
      // Only the exact submitted draft is cleared. New typing/context/files survive completion.
      if (options.draftRevision != null && get().drafts[activeId]?.revision === options.draftRevision) {
        get().setDraft(activeId, draftValue())
        if (get().activeId === activeId) set({ context: null })
      }
      return { ...result, sessionId: activeId, assistantId }
    } catch (error) {
      update(m => ({ content: acc || (error.name === 'AbortError' ? '回复已中断。' : error.message), error: true, requestRejected: error.status >= 400 && error.status < 500, toolCalls: finishRunningToolCalls(m.toolCalls), task: { ...m.task, status: 'failed', label: error.name === 'AbortError' ? '生成已中断' : '生成失败' } }))
      return { error }
    } finally {
      options.signal?.removeEventListener('abort', abort)
      if (generation === run) { generation = null; set({ running: false, runningSessionId: null }) }
    }
  },

}), { name: 'xiao-chat', storage: accountStorage,
  partialize: s => ({ sessions: s.sessions, conversations: s.conversations, activeId: s.activeId }),
  merge: (persisted, current) => ({ ...current, ...persisted, running: false, runningSessionId: null, drafts: {}, conversations: Object.fromEntries(Object.entries(persisted?.conversations || current.conversations).map(([id, messages]) => [id, messages.map(restoreChatMessage)])) }),
}))

export const useInterviewStore = create((set, get) => ({
  phase: 'config', // config | prepare | running | report
  position: positions[0],
  difficulty: difficulties[0],
  mode: 'text', // text | voice
  duration: durations[1],
  questions: [],
  index: 0,
  transcript: [], // { q, a, feedback }
  stage: 'asking', // asking | answering | feedback（running 内）
  micOn: false,
  followup: null, // 追问问题（覆盖当前题）
  paused: false,

  configure: async (position, difficulty, mode, duration) => {
    let questions = questionBank[position] || questionBank[positions[0]]
    try {
      const remote = await fetchQuestions(position, difficulty)
      if (remote.items && remote.items.length > 0) questions = remote.items
    } catch (error) { console.error('题库加载失败，使用本地兜底', error) }
    set({
      position,
      difficulty,
      mode,
      duration,
      questions,
      index: 0,
      transcript: [],
      stage: 'asking',
      phase: 'prepare',
      followup: null,
      paused: false,
      messages: [], answerError: '', micOn: false,
    })
  },

  messages: [],
  answerError: '',
  start: () => set(s => ({ phase: 'running', stage: 'asking', messages: [{ role: 'assistant', text: s.questions[s.index] || '', time: Date.now() }], answerError: '' })), 

  setMic: (on) => set({ micOn: on }),

  setMode: (mode) => set({ mode }),

  submitAnswer: async (answer) => {
    const clean = (answer || '').trim()
    if (!clean) return
    const { position, questions, index, transcript, followup, stage, messages } = get()
    if (stage !== 'asking') return false
    const q = followup || questions[index]
    const userMessage = { role: 'user', text: clean, time: Date.now() }
    const history = messages[messages.length - 1]?.role === 'user' ? messages.slice(0, -1) : messages
    set({ stage: 'feedbacking', answerError: '', micOn: false, messages: [...history, userMessage] })
    try {
      const feedback = await fetchInterviewFeedback(position, q, clean, history)
      if (get().phase !== 'running' || get().index !== index || get().stage !== 'feedbacking') return false
      set(s => ({ transcript: [...transcript, { q, a: clean, feedback }], stage: 'feedback',
        messages: [...s.messages, { role: 'assistant', text: feedback.reply || feedback.suggestions.join('。'), time: Date.now() }] }))
      return true
    } catch (error) {
      if (get().phase === 'running') set({ stage: 'asking', answerError: error.message || '反馈生成失败，请重试' })
      return false
    }
  },

  nextQuestion: () => {
    const { index, questions } = get()
    if (index + 1 >= questions.length) set({ phase: 'report', stage: 'asking', followup: null })
    else set(s => ({ index: index + 1, stage: 'asking', followup: null, micOn: false, answerError: '', messages: [...s.messages, { role: 'assistant', text: questions[index + 1], time: Date.now() }] }))
  },

  togglePause: () => set(s => ({ paused: !s.paused })),

  followUp: () => {
    const { questions, index } = get()
    const base = questions[index] || ''
    const followup = `追问：关于「${base.slice(0, 18)}…」，能否再具体讲讲你当时怎么做的？`
    set(s => ({ stage: 'asking', followup, micOn: false, answerError: '', messages: [...s.messages, { role: 'assistant', text: followup, time: Date.now() }] }))
  },

  end: () => set({ phase: 'report', stage: 'asking', micOn: false }),

  reset: () => set({ phase: 'config', questions: [], index: 0, transcript: [], stage: 'asking', micOn: false, followup: null, paused: false }),
}))

// ---------------------------------------------------------------------------
// 学习：进度 / 收藏 / 笔记（登录后自动同步到后端 /api/users/me/learning）
// ---------------------------------------------------------------------------
let __learningSyncTimer = null
function __syncLearningToBackend() {
  clearTimeout(__learningSyncTimer)
  const epoch = accountEpoch
  __learningSyncTimer = setTimeout(() => {
    if (epoch !== accountEpoch || !useAuthStore.getState().user || useAuthStore.getState().status !== 'authenticated') return
    const s = useLearningStore.getState()
    saveLearningState({
      progress: s.progress,
      bookmarks: s.bookmarks,
      notes: s.notes,
      quizResults: s.quizResults,
    }).catch(() => {})
  }, 800)
}

export const useLearningStore = create(persist((set) => ({
  profile: { direction: '', level: '' }, // 求职方向 / 经验（冷启动画像）
  bookmarks: [],
  progress: {}, // { chapterId: 0~1 }
  setProfile: (profile) => { set({ profile }); __syncLearningToBackend() },
  toggleBookmark: (id) => {
    set(s => ({
      bookmarks: s.bookmarks.includes(id) ? s.bookmarks.filter(b => b !== id) : [...s.bookmarks, id],
    }))
    __syncLearningToBackend()
  },
  setProgress: (id, p) => { set(s => ({ progress: { ...s.progress, [id]: p } })); __syncLearningToBackend() },
  notes: {}, // { chapterId: string }
  quizResults: {}, // { chapterId: { score, total } }
  setNote: (id, text) => { set(s => ({ notes: { ...s.notes, [id]: text } })); __syncLearningToBackend() },
  setQuizResult: (id, score, total) => {
    set(s => ({ quizResults: { ...s.quizResults, [id]: { score, total } } }))
    __syncLearningToBackend()
  },
}), { name: 'xiao-learning', storage: accountStorage, partialize: (s) => ({ profile: s.profile, bookmarks: s.bookmarks, progress: s.progress, notes: s.notes, quizResults: s.quizResults }) }))

// ---------------------------------------------------------------------------
// 账号 / 角色（前端 mock，后端接入后替换为 JWT 鉴权）
// ---------------------------------------------------------------------------
function switchAccount(user) {
  accountEpoch += 1
  clearTimeout(__learningSyncTimer)
  useChatStore.getState().stopGeneration()
  generation = null
  backendSessionPromises.clear()
  const next = user ? `user:${user.id || user.username || user.name}` : 'guest'
  // Read before setState (persist writes immediately), and never copy guest state to a user.
  accountNamespace = next
  const chat = accountStorage.getItem('xiao-chat')?.state
  const learning = accountStorage.getItem('xiao-learning')?.state
  useChatStore.setState({ ...emptyChat(), ...(chat || {}), conversations: Object.fromEntries(Object.entries(chat?.conversations || {}).map(([id, messages]) => [id, messages.map(restoreChatMessage)])), drafts: {}, running: false, runningSessionId: null })
  useLearningStore.setState({ ...emptyLearning(), ...(learning || {}) })
  useInterviewStore.getState().reset()
  useInterviewStore.setState({ messages: [], answerError: '' })
}
async function hydrateAccount(user) {
  switchAccount(user)
  const epoch = accountEpoch
  await Promise.all([
    useChatStore.getState().hydrateSessions(),
    fetchLearningState().then(remote => { if (epoch === accountEpoch && remote) useLearningStore.setState({ ...emptyLearning(), ...remote }) }),
  ])
}
let validationPromise = null
export const useAuthStore = create(persist((set, get) => ({
  user: null,
  status: 'unverified', // Shell calls validateCurrentUser once before protected UI.
  error: '',
  login: async (name, password) => {
    const { user } = await backendLogin(name, password)
    set({ user, status: 'authenticated', error: '' })
    await hydrateAccount(user).catch(error => { if (get().user) set({ status: 'error', error: error.message }); throw error })
    if (!get().user) throw new Error('登录已失效，请重新登录')
    return user
  },
  validateCurrentUser: () => {
    if (validationPromise) return validationPromise
    validationPromise = (async () => {
      if (!hasAuthTokens()) {
        if (get().user) { globalThis.dispatchEvent?.(new CustomEvent(AUTH_EXPIRED_EVENT)); if (get().status !== 'expired') { switchAccount(null); set({ user: null, status: 'expired', error: '登录已失效，请重新登录' }) } }
        else set({ status: 'guest' })
        return null
      }
      set({ status: 'validating' })
      try {
        const result = await fetchCurrentUser()
        const user = result.user || result
        set({ user, status: 'authenticated', error: '' })
        await hydrateAccount(user)
        return user
      } catch (error) {
        if (get().status !== 'expired') set({ status: 'error', error: error.message })
        return { error }
      }
    })().finally(() => { validationPromise = null })
    return validationPromise
  },
  enterGuest: () => { switchAccount(null); set({ user: null, status: 'guest', error: '' }); apiLogout().catch(() => {}) },
  logout: async () => {
    // Clear visible account data immediately; async callbacks are invalidated by epoch.
    switchAccount(null)
    set({ user: null, status: 'guest', error: '' })
    try { await apiLogout() } catch (error) { set({ error: error.message }) }
  },
  clearData: async () => {
    await deleteCurrentUserData()
    useChatStore.getState().stopGeneration()
    useChatStore.setState(emptyChat())
    useLearningStore.setState(emptyLearning())
  },
}), { name: 'xiao-auth', partialize: s => ({ user: s.user }) }))
globalThis.addEventListener?.(AUTH_EXPIRED_EVENT, () => {
  switchAccount(null)
  useAuthStore.setState({ user: null, status: 'expired', error: '登录已失效，请重新登录' })
})
