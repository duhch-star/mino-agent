import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { positions, difficulties, durations, questionBank, makeFeedback } from './data/interview.js'

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

function cannedReply(text) {
  return (
    `收到，关于「**${text.slice(0, 40)}${text.length > 40 ? '…' : ''}**」，我可以从求职的角度帮你梳理：\n\n` +
    `- 明确你的**目标岗位**与核心能力\n` +
    `- 用 STAR 结构组织你的表达\n` +
    `- 结合你的简历给出可落地建议\n\n` +
    '```js\n// 接入真实 LLM 后端后，这里返回流式回答\nconst reply = await agent.chat(text)\n```\n\n' +
    `相关章节：[[面试官如何评价 STAR 回答]]`
  )
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
  context: null, // 就地追问上下文 { title, snippet }

  newSession: () => {
    const id = `s${++chatIdSeq}`
    set(s => ({
      sessions: [{ id, title: '新对话' }, ...s.sessions],
      conversations: { ...s.conversations, [id]: [] },
      activeId: id,
    }))
  },

  selectSession: (id) => set({ activeId: id }),

  setContext: (ctx) => set({ context: ctx }),
  clearContext: () => set({ context: null }),

  sendMessage: (text) => {
    const clean = text.trim()
    if (!clean) return
    const { activeId, conversations, sessions, context } = get()
    const full = context ? `（关于《${context.title}》：${context.snippet}）\n${clean}` : clean
    set({
      running: true,
      context: null,
      conversations: {
        ...conversations,
        [activeId]: [...(conversations[activeId] || []), { id: `u${Date.now()}`, role: 'user', content: full }],
      },
      sessions: sessions.map(s =>
        s.id === activeId && s.title === '新对话'
          ? { ...s, title: clean.length > 16 ? clean.slice(0, 16) + '…' : clean }
          : s,
      ),
    })
    setTimeout(() => {
      const state = get()
      set({
        running: false,
        conversations: {
          ...state.conversations,
          [activeId]: [...(state.conversations[activeId] || []), { id: `a${Date.now()}`, role: 'assistant', content: cannedReply(clean) }],
        },
      })
    }, 900)
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

  configure: (position, difficulty, mode, duration) => set({
    position,
    difficulty,
    mode,
    duration,
    questions: questionBank[position] || questionBank[positions[0]],
    index: 0,
    transcript: [],
    stage: 'asking',
    phase: 'prepare',
    followup: null,
    paused: false,
  }),

  start: () => set({ phase: 'running', stage: 'asking' }),

  setMic: (on) => set({ micOn: on }),

  setMode: (mode) => set({ mode }),

  submitAnswer: (answer) => {
    const clean = (answer || '').trim()
    if (!clean) return
    const { position, questions, index, transcript } = get()
    const q = questions[index]
    const feedback = makeFeedback(position, q, clean)
    set({
      transcript: [...transcript, { q, a: clean, feedback }],
      stage: 'feedback',
    })
  },

  nextQuestion: () => {
    const { index, questions } = get()
    if (index + 1 >= questions.length) set({ phase: 'report', stage: 'asking', followup: null })
    else set({ index: index + 1, stage: 'asking', followup: null })
  },

  togglePause: () => set(s => ({ paused: !s.paused })),

  followUp: () => {
    const { questions, index } = get()
    const base = questions[index] || ''
    set({ stage: 'asking', followup: `追问：关于「${base.slice(0, 18)}…」，能否再具体讲讲你当时怎么做的？`, micOn: false })
  },

  end: () => set({ phase: 'report', stage: 'asking', micOn: false }),

  reset: () => set({ phase: 'config', questions: [], index: 0, transcript: [], stage: 'asking', micOn: false, followup: null, paused: false }),
}))

// ---------------------------------------------------------------------------
// 学习：进度 / 收藏 / 笔记（演示用内存态）
// ---------------------------------------------------------------------------
export const useLearningStore = create(persist((set) => ({
  profile: { direction: '', level: '' }, // 求职方向 / 经验（冷启动画像）
  bookmarks: [],
  progress: {}, // { chapterId: 0~1 }
  setProfile: (profile) => set({ profile }),
  toggleBookmark: (id) => set(s => ({
    bookmarks: s.bookmarks.includes(id) ? s.bookmarks.filter(b => b !== id) : [...s.bookmarks, id],
  })),
  setProgress: (id, p) => set(s => ({ progress: { ...s.progress, [id]: p } })),
  notes: {}, // { chapterId: string }
  quizResults: {}, // { chapterId: { score, total } }
  setNote: (id, text) => set(s => ({ notes: { ...s.notes, [id]: text } })),
  setQuizResult: (id, score, total) => set(s => ({ quizResults: { ...s.quizResults, [id]: { score, total } } })),
}), { name: 'xiao-learning', partialize: (s) => ({ profile: s.profile, bookmarks: s.bookmarks, progress: s.progress, notes: s.notes, quizResults: s.quizResults }) }))

// ---------------------------------------------------------------------------
// 账号 / 角色（前端 mock，后端接入后替换为 JWT 鉴权）
// ---------------------------------------------------------------------------
export const useAuthStore = create(persist((set) => ({
  user: null, // { name, role: 'user' | 'admin' }
  login: (name, role) => set({ user: { name: name || (role === 'admin' ? '管理员' : '求职者'), role } }),
  logout: () => set({ user: null }),
}), { name: 'xiao-auth' }))
