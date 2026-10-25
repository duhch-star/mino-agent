import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { positions, difficulties, durations, questionBank } from './data/interview.js'
import { streamChatMessage, fetchInterviewFeedback, backendLogin, createBackendChatSession, fetchBackendChatSessions, fetchBackendChatMessages, renameBackendChatSession, deleteBackendChatSession, uploadChatAttachments, fetchQuestions, apiLogout, deleteCurrentUserData, saveLearningState, fetchLearningState } from './api.js'

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
  context: null, // 就地追问上下文 { title, snippet }

  hydrateSessions: async () => {
    const { items = [] } = await fetchBackendChatSessions()
    const conversations = {}
    await Promise.all(items.map(async session => {
      const result = await fetchBackendChatMessages(session.id)
      conversations[session.id] = result.items || []
    }))
    set({
      sessions: items.map(item => ({ id: item.id, title: item.title, parentId: item.parentId, branchMessageId: item.branchMessageId })),
      conversations,
      activeId: items.some(item => item.id === get().activeId) ? get().activeId : items[0]?.id || null,
    })
  },

  newSession: () => {
    const id = `s${++chatIdSeq}`
    set(s => ({
      sessions: [{ id, title: '新对话' }, ...s.sessions],
      conversations: { ...s.conversations, [id]: [] },
      activeId: id,
    }))
  },

  selectSession: (id) => set({ activeId: id }),

  renameSession: (id, title) => {
    const cleanTitle = title.trim()
    if (!cleanTitle) return
    if (id.startsWith('conv_')) renameBackendChatSession(id, cleanTitle).catch(error => console.error(error))
    set(state => ({ sessions: state.sessions.map(session => session.id === id ? { ...session, title: cleanTitle.slice(0, 48) } : session) }))
  },

  deleteSession: (id) => {
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

  branchConversation: (sessionId, messageId) => {
    const { sessions, conversations } = get()
    const sourceMessages = conversations[sessionId] || []
    const messageIndex = sourceMessages.findIndex(message => message.id === messageId)
    if (messageIndex < 0) return
    const sourceSession = sessions.find(session => session.id === sessionId)
    const id = `s${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    const title = `继续：${sourceSession?.title || '求职对话'}`.slice(0, 24)
    const branchedMessages = sourceMessages.slice(0, messageIndex + 1).map(message => ({
      ...message,
      references: message.references?.map(reference => ({ ...reference })),
      attachments: message.attachments?.map(file => ({ ...file })),
      options: message.options ? { ...message.options } : undefined,
      task: message.task ? { ...message.task } : undefined,
    }))
    set(state => ({
      sessions: [{ id, title, branchedFrom: sessionId }, ...state.sessions],
      conversations: { ...state.conversations, [id]: branchedMessages },
      activeId: id,
    }))
  },

  setContext: (ctx) => set({ context: ctx }),
  clearContext: () => set({ context: null }),
  setMessageFeedback: (sessionId, messageId, feedback) => set(state => ({
    conversations: {
      ...state.conversations,
      [sessionId]: (state.conversations[sessionId] || []).map(message =>
        message.id === messageId ? { ...message, feedback: message.feedback === feedback ? null : feedback } : message,
      ),
    },
  })),

  sendMessage: async (text, options = {}) => {
    const clean = text.trim()
    const attachments = (options.attachments || []).map(file => ({
      name: file.name,
      type: file.type,
      size: file.size,
      lastModified: file.lastModified,
    }))
    if (!clean && !attachments.length && !get().context) return
    let uploadedAttachments = []
    if (options.attachments?.length) {
      const uploadResult = await uploadChatAttachments(options.attachments)
      uploadedAttachments = uploadResult.files || []
    }
    let { activeId, conversations, sessions, context } = get()
    if (!activeId || !activeId.startsWith('conv_')) {
      const current = sessions.find(session => session.id === activeId)
      const created = await createBackendChatSession({ title: current?.title || '新对话' })
      const previousId = activeId
      activeId = created.id
      conversations = { ...conversations, [activeId]: conversations[previousId] || [] }
      delete conversations[previousId]
      sessions = previousId
        ? sessions.map(session => session.id === previousId ? { ...session, id: activeId, title: clean.slice(0, 40) || session.title } : session)
        : [{ id: activeId, title: clean.slice(0, 40) || '新对话' }, ...sessions]
      set({ activeId, sessions, conversations })
      if (clean) renameBackendChatSession(activeId, clean.slice(0, 40)).catch(error => console.error(error))
    }
    const full = context ? `（关于《${context.title}》：${context.snippet}）\n${clean}` : clean
    const references = [
      ...(context ? [{ kind: 'knowledge', title: context.title }] : []),
      ...attachments.map(file => ({ kind: 'file', title: file.name, status: uploadedAttachments.some(item => item.name === file.name) ? 'ready' : 'failed' })),
    ]
    const attachmentMeta = attachments.map(file => ({ ...file, status: uploadedAttachments.some(item => item.name === file.name) ? 'ready' : 'failed' }))
    const userMsg = { id: `u${Date.now()}`, role: 'user', content: full || '请结合附件进行分析', attachments: attachmentMeta, references, options: { mode: options.mode, depth: options.depth, tool: options.tool } }
    const assistantId = `a${Date.now()}`
    set({
      running: true,
      context: null,

      conversations: {
        ...conversations,
        [activeId]: [...(conversations[activeId] || []), userMsg, {
          id: assistantId,
          role: 'assistant',
          content: '',
          references,
          task: {
            status: 'running',
            mode: options.mode || 'career',
            tool: options.tool || null,
            depth: options.depth || 'standard',
          },
        }],
      },
      sessions: sessions.map(s =>
        s.id === activeId && s.title === '新对话'
          ? { ...s, title: clean ? (clean.length > 16 ? clean.slice(0, 16) + '…' : clean) : attachments[0]?.name || '附件分析' }
          : s,
      ),
    })
    let acc = ''
    let pendingUi = null
    try {
      const result = await streamChatMessage({
        conversationId: activeId,
        text: clean,
        context: context || {},
        mode: options.mode || 'career',
        depth: options.depth || 'standard',
        tool: options.tool || null,
        attachments: attachmentMeta,
        attachmentIds: uploadedAttachments.map(file => file.id),
      }, {
        onActivity: activity => {
          set(state => {
            const list = state.conversations[activeId] || []
            return { conversations: { ...state.conversations, [activeId]: list.map(m => m.id === assistantId ? { ...m, task: { ...m.task, status: activity.status, label: activity.label } } : m) } }
          })
        },
        onChunk: chunk => {
          acc += chunk
          set(state => {
            const list = state.conversations[activeId] || []
            return {
              conversations: {
                ...state.conversations,
                [activeId]: list.map(m => m.id === assistantId ? { ...m, content: acc } : m),
              },
            }
          })
        },
        onUi: ui => {
          pendingUi = ui // 流式期间收到生成式 UI，done 时写入消息
        },
        onComplete: result => {
          set(state => {
            const list = state.conversations[activeId] || []
            return { conversations: { ...state.conversations, [activeId]: list.map(m => m.id === assistantId ? { ...m, usage: result.usage, performance: result.performance, task: { ...m.task, status: 'completed', skills: result.skills || [] }, ui: result.ui || pendingUi } : m) } }
          })
        },
      })
      return result
    } catch (error) {
      set(state => {
        const list = state.conversations[activeId] || []
        return { conversations: { ...state.conversations, [activeId]: list.map(m => m.id === assistantId ? { ...m, content: acc || error.message || '暂时无法生成回复，请稍后重试。', error: true, task: { ...m.task, status: 'failed', label: '生成失败' } } : m) } }
      })
      return { error }
    } finally {
      set({ running: false })
    }
  },
}), { name: 'xiao-chat', partialize: (s) => ({ sessions: s.sessions, conversations: s.conversations, activeId: s.activeId }) }))

// ---------------------------------------------------------------------------
// 面试：流程状态机（config → prepare → running → report）
// ---------------------------------------------------------------------------
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
  __learningSyncTimer = setTimeout(() => {
    if (!useAuthStore.getState().user) return
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
}), { name: 'xiao-learning', partialize: (s) => ({ profile: s.profile, bookmarks: s.bookmarks, progress: s.progress, notes: s.notes, quizResults: s.quizResults }) }))

// ---------------------------------------------------------------------------
// 账号 / 角色（前端 mock，后端接入后替换为 JWT 鉴权）
// ---------------------------------------------------------------------------
export const useAuthStore = create(persist((set) => ({
  user: null, // { name, role: 'user' | 'admin' }
  login: async (name, password, role) => {
    const { user } = await backendLogin(name, password)
    set({ user })
    await useChatStore.getState().hydrateSessions().catch(() => {})
    // 拉取服务端学习状态并合并（游客期本地积累不丢失；多设备取进度最大值）
    fetchLearningState().then(remote => {
      if (!remote) return
      const cur = useLearningStore.getState()
      const rp = remote.progress || {}
      const progress = {}
      for (const id of new Set([...Object.keys(rp), ...Object.keys(cur.progress)])) {
        progress[id] = Math.max(rp[id] ?? 0, cur.progress[id] ?? 0)
      }
      useLearningStore.setState({
        progress,
        bookmarks: [...new Set([...(remote.bookmarks || []), ...cur.bookmarks])],
        notes: { ...(remote.notes || {}), ...cur.notes },
        quizResults: { ...(remote.quizResults || {}), ...cur.quizResults },
      })
    }).catch(() => {})
    return user
  },
  logout: async () => {
    try { await apiLogout() } catch (error) { console.error(error) }
    set({ user: null })
  },
  // 注销并清除服务端数据（隐私模块）
  clearData: async () => {
    try { await deleteCurrentUserData() } catch (error) { console.error(error) }
    // 同步清空本地学习状态，避免残留
    useLearningStore.setState({ bookmarks: [], progress: {}, notes: {}, quizResults: {} })
  },
}), { name: 'xiao-auth' }))
