// =====================================================================
// 后端接口层（Interface / Contract）—— 前端唯一的数据出入口
// ---------------------------------------------------------------------
// 当前为 mock 实现（数据取自 src/data/），接入后端时**只需替换函数体**
// 为 fetch 调用，页面 / 组件 / 状态层无需改动。
//
// 每个函数签名即「前端 ↔ 后端」契约，统一返回 Promise。
// 流式接口（streamChatMessage）遵循 SSE 协议：逐 token 回调 onChunk。
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
export async function streamChatMessage(request, { onChunk, onComplete, onError } = {}) {
  const reply = buildMockReply(request)
  for (const chunk of tokenize(reply)) {
    await sleep(20)
    onChunk?.(chunk)
  }
  const result = { message: reply, usage: null, performance: null }
  onComplete?.(result)
  return result
}

function tokenize(text) {
  const chunks = []
  for (let i = 0; i < text.length; i += 2) chunks.push(text.slice(i, i + 2))
  return chunks
}

function buildMockReply({ text, context, mode, depth, tool, attachments = [] }) {
  const topic = text.slice(0, 24)
  const modeLabels = { career: '求职咨询', resume: '简历优化', interview: '面试练习' }
  const toolLabels = { resume_analysis: '分析简历', job_description: '分析岗位描述', knowledge_search: '检索知识库', star_stories: '整理 STAR 案例' }
  return (
    (context ? `> 关于《${context.title}》这段内容，我的理解是：\n\n` : '') +
    `${attachments.length ? `已收到 ${attachments.length} 个待分析文件（当前为界面演示，尚未上传文件内容）。\n\n` : ''}` +
    `当前模式：${modeLabels[mode] || modeLabels.career}${tool ? `；工具：${toolLabels[tool] || tool}` : ''}；回答档位：${depth === 'deep' ? '深入分析' : '标准回答'}。\n\n` +
    `你问的是「${topic || '请结合附件进行分析'}${text.length > 24 ? '…' : ''}」，从求职角度我的建议：\n\n` +
    `## 要点\n\n- 把**你的能力**对应到目标岗位要求\n- 用 STAR 结构组织经历，突出「我做了什么」\n- 结论先行，再用数据佐证\n\n` +
    '```js\n// 接入后端 LLM 后，这里返回真实的流式回答\nconst reply = await fetch("/api/chat", { method: "POST" })\n```\n\n' +
    `需要更具体的建议，可以告诉我你的目标岗位。`
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
/** 按岗位下发题目 */ export async function fetchQuestions(position) { /* GET /api/interview/questions?position= */ return mock(questionBank[position] || []) }
/** 提交回答 → 维度化反馈 */ export async function fetchInterviewFeedback(position, question, answer) { /* POST /api/interview/feedback */ return mock(makeFeedback(position, question, answer), 600) }

// ---------------------------------------------------------------------
// 鉴权 / 账号
// ---------------------------------------------------------------------
/** 登录 */ export async function apiLogin(name, role) { /* POST /api/auth/login */ return mock({ user: { name: name || (role === 'admin' ? '管理员' : '求职者'), role }, token: 'mock-jwt' }) }

// ---------------------------------------------------------------------
// 职业辅导
// ---------------------------------------------------------------------
/** 简历分析 */ export async function analyzeResume(text) { /* POST /api/career/resume/analyze */ return mock(['量化结果较少：每条经历补一个可衡量的数据', '建议用 STAR 结构改写']) }

// ---------------------------------------------------------------------
// 内容审核（管理员）
// ---------------------------------------------------------------------
/** 待审核章节草稿 */ export async function fetchReviewDrafts() { /* GET /api/review/drafts */ return mock([]) }
/** 审核通过/驳回 */ export async function reviewDraft(id, action) { /* POST /api/review/drafts/:id */ return mock({ ok: true }) }
