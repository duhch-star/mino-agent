// =====================================================================
// 后端接口层（Interface / Contract）—— 前端唯一的数据出入口
// ---------------------------------------------------------------------
// 当前为 mock 实现（数据取自 src/data/），接入后端时**只需替换函数体**
// 为 fetch 调用，页面 / 组件 / 状态层无需改动。
//
// 每个函数签名即「前端 ↔ 后端」契约，统一返回 Promise。
// 当前所有函数均为 mock，不会发送真实网络请求。
// 流式接口（streamChatMessage）遵循 SSE 协议：内容、活动、完成事件分别回调。
// =====================================================================

import { colleges, collegeById, majorById } from './data/colleges.js'
import { textbookGroups } from './data/textbooks.js'
import { chapters, chapterById, quizBank } from './data/chapters.js'
import { questionBank, makeFeedback } from './data/interview.js'

const sleep = (ms) => new Promise(r => setTimeout(r, ms))
const mock = (data, ms = 200) => new Promise(r => setTimeout(() => r(data), ms))

// ---------------------------------------------------------------------
// 对话助手（流式，SSE 协议）
// ---------------------------------------------------------------------
// 真实实现示例（后端以 text/event-stream 逐 token 推送）：
//   const res = await fetch('/api/chat', {
//     method: 'POST',
//     headers: { 'Content-Type': 'application/json' },
//     body: JSON.stringify(request),
//   })
//   const reader = res.body.getReader()
//   const dec = new TextDecoder()
//   let buf = ''
//   while (true) {
//     const { done, value } = await reader.read()
//     if (done) break
//     buf += dec.decode(value, { stream: true })
//     for (const line of buf.split('\n')) {
//       if (line.startsWith('data:')) onChunk(JSON.parse(line.slice(5)).delta)
//     }
//   }
export async function streamChatMessage(request, { onChunk, onActivity, onComplete, onError } = {}) {
  const reply = buildMockReply(request)
  onActivity?.({ type: 'status', status: 'running', label: '正在生成回答' })
  for (const chunk of tokenize(reply)) {
    await sleep(20)
    onChunk?.(chunk)
  }
  const result = { message: reply, usage: null, performance: null }
  onActivity?.({ type: 'status', status: 'completed', label: '回答已生成' })
  onComplete?.(result)
  return result
}

/** POST /api/chat/attachments; mock 只返回待上传元数据，不读取或传输文件内容。 */
export async function uploadChatAttachments(files) {
  return mock({ files: files.map((file, index) => ({
    id: `pending-${Date.now()}-${index}`,
    name: file.name,
    type: file.type,
    size: file.size,
    status: 'pending_upload',
  })) })
}

/** POST /api/chat/feedback */
export async function submitChatFeedback({ conversationId, messageId, rating, reason = null }) {
  return mock({ conversationId, messageId, rating, reason, accepted: true })
}

/** POST /api/chat/sessions */
export async function createChatSession(payload = {}) { return mock({ id: `mock-session-${Date.now()}`, ...payload, title: payload.title || '新对话' }) }
/** GET /api/chat/sessions */
export async function fetchChatSessions() { return mock({ items: [] }) }
/** PATCH /api/chat/sessions/:id */
export async function renameChatSession(id, title) { return mock({ id, title }) }
/** DELETE /api/chat/sessions/:id */
export async function deleteChatSession(id) { return mock({ id, deleted: true }) }

// 面试会话接口。题目/反馈仍由现有 mock 数据适配，后端接入时替换实现。
/** POST /api/interview/sessions */
export async function createInterviewSession(config) { return mock({ id: `mock-interview-${Date.now()}`, ...config, status: 'active' }) }
/** POST /api/interview/sessions/:id/answers */
export async function submitInterviewAnswer(sessionId, payload) { return mock({ sessionId, ...payload, feedback: makeFeedback(payload.position, payload.question, payload.answer) }, 600) }
/** POST /api/interview/sessions/:id/finish */
export async function finishInterviewSession(sessionId) { return mock({ sessionId, status: 'completed' }) }

// 职业辅导与求职画像。
/** POST /api/career/jobs/match */
export async function matchJobs(profile) { return mock({ items: [], profile }) }
/** POST /api/career/star/organize */
export async function organizeStarStory(experience) { return mock({ situation: '', task: '', action: experience || '', result: '', suggestions: [] }) }
/** GET /api/users/me/profile */
export async function fetchUserProfile() { return mock({ profile: { direction: '', level: '', targetRoles: [] } }) }
/** PUT /api/users/me/profile */
export async function saveUserProfile(profile) { return mock({ profile }) }
/** GET /api/users/me/learning */
export async function fetchLearningState() { return mock({ progress: {}, bookmarks: [], notes: {}, quizResults: {} }) }
/** PUT /api/users/me/learning */
export async function saveLearningState(state) { return mock({ state }) }

function tokenize(text) {
  const chunks = []
  for (let i = 0; i < text.length; i += 2) chunks.push(text.slice(i, i + 2))
  return chunks
}

function buildMockReply({ text, context, attachments = [] }) {
  const topic = text.slice(0, 24)
  return (
    (context ? `> 关于《${context.title}》这段内容，我的理解是：\n\n` : '') +
    `${attachments.length ? '当前附件仅保留在本地选择状态，接入上传接口后才能分析文件内容。\n\n' : ''}` +
    `关于「${topic || '你的求职问题'}${text.length > 24 ? '…' : ''}」，可以先从以下方面梳理：\n\n` +
    `## 要点\n\n- 把**你的能力**对应到目标岗位要求\n- 用 STAR 结构组织经历，突出「我做了什么」\n- 结论先行，再用数据佐证\n\n` +
    `需要更具体的建议，可以补充目标岗位、相关经历或你最想解决的问题。`
  )
}

// ---------------------------------------------------------------------
// 知识库：学院 / 专业 / 核心课程 / 教材章节
// ---------------------------------------------------------------------
/** 学院列表 */ export async function fetchColleges() { /* GET /api/knowledge/colleges */ return mock(colleges) }
/** 学院详情（含专业列表） */ export async function fetchCollege(id) { /* GET /api/knowledge/colleges/:id */ return mock(collegeById(id)) }
/** 专业详情（核心课程 + 能力关键词 + 适配岗位） */ export async function fetchMajor(id) { /* GET /api/knowledge/majors/:id */ return mock(majorById(id)) }
/** 教材章节目录 */ export async function fetchTextbookGroups() { /* GET /api/knowledge/textbooks */ return mock(textbookGroups) }

// ---------------------------------------------------------------------
// 求职指南
// ---------------------------------------------------------------------
/** 指南列表 */ export async function fetchGuides() { /* GET /api/guides */ return mock(chapters) }
/** 指南详情（章节正文） */ export async function fetchGuide(id) { /* GET /api/guides/:id */ return mock(chapterById(id)) }
/** 章节测验 */ export async function fetchQuiz(id) { /* GET /api/guides/:id/quiz */ return mock(quizBank[id] || []) }

// ---------------------------------------------------------------------
// 面试
// ---------------------------------------------------------------------
/** 按岗位和难度下发题目 */ export async function fetchQuestions(position, difficulty) { /* GET /api/interview/questions?position=&difficulty= */ return mock({ position, difficulty, items: questionBank[position] || [] }) }
/** 提交回答 → 维度化反馈 */ export async function fetchInterviewFeedback(position, question, answer) { /* POST /api/interview/feedback */ return mock(makeFeedback(position, question, answer), 600) }

// ---------------------------------------------------------------------
// 鉴权 / 账号
// ---------------------------------------------------------------------
/** 登录；role 仅用于本地演示，真实服务必须根据账号权限返回角色。 */
export async function apiLogin(name, password, role = 'user') {
  return mock({ user: { id: 'mock-user', name: name || (role === 'admin' ? '管理员' : '求职者'), role }, accessToken: 'mock-jwt', refreshToken: null, expiresIn: null, passwordAccepted: Boolean(password) })
}
export async function refreshAuthToken() { return mock({ accessToken: 'mock-jwt', refreshToken: null, expiresIn: null }) }
export async function apiLogout() { return mock({ ok: true }) }
export async function fetchCurrentUser() { return mock({ id: 'mock-user', name: '求职者', role: 'user' }) }
export async function fetchUsageSummary() { return mock({ today: null, limit: null }) }
export async function deleteCurrentUserData() { return mock({ deleted: true }) }

// ---------------------------------------------------------------------
// 职业辅导
// ---------------------------------------------------------------------
/** 简历分析 */
export async function analyzeResume({ text = '', attachmentIds = [] } = {}) {
  return mock({ summary: '演示分析结果，正式接入后由服务端生成。', sections: [], suggestions: text || attachmentIds.length ? ['量化结果较少：每条经历补一个可衡量的数据', '建议用 STAR 结构改写'] : [], jobMatches: [] })
}

// ---------------------------------------------------------------------
// 内容审核（管理员）
// ---------------------------------------------------------------------
/** 待审核章节草稿 */ export async function fetchReviewDrafts() { /* GET /api/review/drafts */ return mock([]) }
/** 审核通过/驳回 */ export async function reviewDraft(id, action) { /* POST /api/review/drafts/:id */ return mock({ ok: true }) }
