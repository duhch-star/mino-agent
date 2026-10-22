// =====================================================================
// 后端接口层（Interface / Contract）—— 前端唯一的数据出入口
// ---------------------------------------------------------------------
// 当前为 mock 实现（数据取自 src/data/），接入后端时**只需替换函数体**
// 为 fetch 调用，页面 / 组件 / 状态层无需改动。
//
// 每个函数签名即「前端 ↔ 后端」契约，统一返回 Promise。
// =====================================================================

import { colleges, collegeById, majorById } from './data/colleges.js'
import { textbookGroups } from './data/textbooks.js'
import { chapters, chapterById, quizBank } from './data/chapters.js'
import { questionBank, makeFeedback } from './data/interview.js'

// 模拟网络延迟返回
const mock = (data, ms = 200) => new Promise(r => setTimeout(() => r(data), ms))

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
/** 提交回答 → 维度化反馈 */ export async function fetchInterviewFeedback(position, question, answer) { /* POST /api/interview/feedback */ return mock(makeFeedback(position, question, answer)) }

// ---------------------------------------------------------------------
// 对话助手
// ---------------------------------------------------------------------
/** 发送消息（建议流式） */ export async function sendChatMessage(text, context) { /* POST /api/chat */ return mock({ reply: `（演示回复）关于「${text.slice(0, 40)}」…` }) }

// ---------------------------------------------------------------------
// 鉴权 / 账号
// ---------------------------------------------------------------------
/** 登录 */ export async function apiLogin(name, role) { /* POST /api/auth/login */ return mock({ user: { name, role }, token: 'mock-jwt' }) }

// ---------------------------------------------------------------------
// 职业辅导
// ---------------------------------------------------------------------
/** 简历分析 */ export async function analyzeResume(text) { /* POST /api/career/resume/analyze */ return mock(['量化结果较少：每条经历补一个可衡量的数据', '建议用 STAR 结构改写']) }

// ---------------------------------------------------------------------
// 内容审核（管理员）
// ---------------------------------------------------------------------
/** 待审核章节草稿 */ export async function fetchReviewDrafts() { /* GET /api/review/drafts */ return mock([]) }
/** 审核通过/驳回 */ export async function reviewDraft(id, action) { /* POST /api/review/drafts/:id */ return mock({ ok: true }) }
