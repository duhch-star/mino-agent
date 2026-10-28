// =====================================================================
// 后端接口层（Interface / Contract）—— 前端唯一的数据出入口
// ---------------------------------------------------------------------
// 已接入真实后端（FastAPI），所有函数均为 HTTP 调用：
//   Base URL: VITE_API_BASE_URL 或 http://127.0.0.1:8000
//   鉴权：Bearer <accessToken>，token 存 localStorage（mino_tokens）
//   流式接口（streamChatMessage）遵循 SSE 协议：activity/delta/tool_call/ui/done/error
// 错误：统一 { error: { code, message, details }, requestId }
// =====================================================================

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'
const tokenStoreKey = 'mino_tokens'

function getTokens() {
  try { return JSON.parse(localStorage.getItem(tokenStoreKey) || '{}') } catch { return {} }
}

function setTokens(tokens) {
  localStorage.setItem(tokenStoreKey, JSON.stringify(tokens || {}))
}

export const AUTH_EXPIRED_EVENT = 'mino:auth-expired'
let authEpoch = 0
export const hasAuthTokens = () => Boolean(getTokens().accessToken || getTokens().refreshToken)
function expireAuth() {
  authEpoch += 1
  setTokens({})
  globalThis.dispatchEvent?.(new CustomEvent(AUTH_EXPIRED_EVENT))
}
let refreshPromise = null

async function refreshTokens() {
  const { refreshToken } = getTokens()
  if (!refreshToken) throw new Error('无刷新令牌')
  if (!refreshPromise) {
    const epoch = authEpoch
    refreshPromise = fetch(`${API_BASE}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    })
      .then(async (r) => {
        if (!r.ok) throw new Error('刷新令牌失效')
        const data = await r.json()
        if (epoch !== authEpoch) throw new Error('账号状态已变化')
        setTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken })
        return data
      })
      .finally(() => { refreshPromise = null })
  }
  return refreshPromise
}

async function requestApi(path, options = {}, retried = false) {
  const epoch = authEpoch
  const headers = new Headers(options.headers || {})
  const accessToken = getTokens().accessToken
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`)
  if (options.body && !(options.body instanceof FormData)) headers.set('Content-Type', 'application/json')
  let response = await fetch(`${API_BASE}${path}`, { ...options, headers })
  if (epoch !== authEpoch && !path.startsWith('/api/auth/')) throw new DOMException('账号状态已变化', 'AbortError')
  // 访问令牌过期 → 尝试用刷新令牌续期后重试一次
  const authEndpoint = path.startsWith('/api/auth/')
  if (response.status === 401 && !retried && !authEndpoint) {
    try {
      await refreshTokens()
      headers.set('Authorization', `Bearer ${getTokens().accessToken}`)
      response = await fetch(`${API_BASE}${path}`, { ...options, headers })
    } catch (error) {
      if (epoch !== authEpoch || options.signal?.aborted) throw error
      expireAuth()
    }
  }
  if (response.status === 401 && !authEndpoint && hasAuthTokens()) expireAuth()
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}))
    const validation = Array.isArray(payload.detail) ? payload.detail.map(item => {
      const field = (item.loc || []).filter(part => part !== 'body').join('.')
      if (item.type === 'string_too_long') return `${field === 'text' ? '消息' : field}超过长度限制（最多 ${item.ctx?.max_length ?? '指定数量'} 字符），请缩短或作为附件上传`
      if (item.type === 'string_too_short') return `${field === 'text' ? '消息' : field}不能为空`
      return `${field || '请求参数'}：${item.msg || '格式不正确'}`
    }).join('；') : ''
    const error = new Error(payload.error?.message || validation || (typeof payload.detail === 'string' ? payload.detail : '') || `请求失败 (${response.status})`)
    error.code = payload.error?.code
    error.status = response.status
    throw error
  }
  return response
}

const requestData = async (path, options) => (await requestApi(path, options)).json()

export const launchPiWeb = (acknowledgeLocalAgent = false) => requestData('/api/pi-web/launch', { method: 'POST', body: JSON.stringify({ acknowledgeLocalAgent }) })
export const stopPiWeb = () => requestData('/api/pi-web/stop', { method: 'POST' })

export const fetchResumeTemplates = () => requestData('/api/resume/templates')
const resumeDocumentPath = id => `/api/resume/documents/${encodeURIComponent(id)}`
export const fetchResumeDocument = id => requestData(resumeDocumentPath(id))
export const fetchResumeHistory = id => requestData(`${resumeDocumentPath(id)}/history`)
export const undoResumeDocument = (id, expectedRevision) => requestData(`${resumeDocumentPath(id)}/undo`, { method: 'POST', body: JSON.stringify({ expectedRevision }) })
export const saveResumeDocument = (id, { resume, template, expectedRevision }) => requestData(resumeDocumentPath(id), { method: 'PUT', body: JSON.stringify({ resume, template, expectedRevision }) })
export const compileResumeDocument = id => requestData(`${resumeDocumentPath(id)}/compile`, { method: 'POST' })
// PDF 端点需要鉴权，不能直接把服务端 URL 交给 iframe。
export async function fetchResumeDocumentPdf(id, revision, pdfUrl) {
  const expectedPath = `${resumeDocumentPath(id)}/pdf`
  const url = new URL(pdfUrl || `${expectedPath}?revision=${encodeURIComponent(revision)}`, API_BASE)
  const base = new URL(API_BASE)
  if (url.origin !== base.origin || url.pathname !== expectedPath || url.searchParams.get('revision') !== String(revision)) throw new Error('PDF 地址与当前会话版本不匹配')
  return (await requestApi(`${url.pathname}${url.search}`)).blob()
}
export const editResumeByChat = (resume, instruction) => requestData('/api/resume/edit', { method: 'POST', body: JSON.stringify({ resume, instruction }) })
export const fetchResumeSource = (resume, template) => requestData('/api/resume/source', { method: 'POST', body: JSON.stringify({ resume, template }) })
export async function compileResumePdf(resume, template) {
  const r = await requestApi('/api/resume/compile', { method: 'POST', body: JSON.stringify({ resume, template }) })
  return { blob: await r.blob(), warnings: Number(r.headers.get('X-Resume-Warnings') || 0) }
}

export async function downloadResumeBundle(resume, template) {
  const r = await requestApi('/api/resume/bundle', { method: 'POST', body: JSON.stringify({ resume, template }) })
  return r.blob()
}

// Backend proxies the Mambo provider: credentials never enter the browser.
export async function generateInterviewSpeech(text, signal) {
  const response = await requestApi('/api/interview/speech', {
    method: 'POST', body: JSON.stringify({ text }), signal,
  })
  return response.blob()
}

// ---------------------------------------------------------------------
// 鉴权 / 账号
// ---------------------------------------------------------------------
/** POST /api/auth/login：账号密码登录，返回 {accessToken, refreshToken, expiresIn, user} */
export async function backendLogin(username, password) {
  authEpoch += 1
  refreshPromise = null
  setTokens({})
  try {
    const data = await requestData('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    })
    setTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken })
    return data
  } catch (error) {
    setTokens({})
    throw error
  }
}

/** POST /api/auth/refresh */
export async function refreshAuthToken() {
  try { return await refreshTokens() } catch (error) { expireAuth(); throw error }
}

/** POST /api/auth/logout */
export async function apiLogout() {
  const { refreshToken, accessToken } = getTokens()
  // Revoke/stop the local Pi capability before discarding MINOS auth.
  if (accessToken) await fetch(`${API_BASE}/api/pi-web/stop`, { method: 'POST', headers: { Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(5000) }).catch(() => {})
  authEpoch += 1
  setTokens({})
  try {
    if (refreshToken) {
      await requestApi('/api/auth/logout', { method: 'POST', body: JSON.stringify({ refresh_token: refreshToken }) })
    }
  } finally {
    setTokens({})
  }
  return { ok: true }
}

/** GET /api/users/me */
export async function fetchCurrentUser() {
  return requestData('/api/users/me')
}

/** GET /api/usage/me */
export async function fetchUsageSummary() {
  return requestData('/api/usage/me')
}

/** DELETE /api/users/me/data */
export async function deleteCurrentUserData() {
  return requestData('/api/users/me/data', { method: 'DELETE' })
}

/** GET /api/users/me/profile */
export async function fetchUserProfile() {
  return requestData('/api/users/me/profile')
}

/** PUT /api/users/me/profile */
export async function saveUserProfile(profile) {
  return requestData('/api/users/me/profile', { method: 'PUT', body: JSON.stringify(profile) })
}

/** GET /api/users/me/learning */
export async function fetchLearningState() {
  return requestData('/api/users/me/learning')
}

/** PUT /api/users/me/learning */
export async function saveLearningState(state) {
  return requestData('/api/users/me/learning', { method: 'PUT', body: JSON.stringify(state) })
}

// ---------------------------------------------------------------------
// 对话助手（流式 SSE）
// ---------------------------------------------------------------------
/** POST /api/chat/sessions：创建对话（支持分支） */
export async function createBackendChatSession(payload = {}) {
  return requestData('/api/chat/sessions', { method: 'POST', body: JSON.stringify(payload) })
}

/** GET /api/chat/sessions */
export async function fetchBackendChatSessions() {
  return requestData('/api/chat/sessions')
}

/** GET /api/chat/sessions/:id/messages */
export async function fetchBackendChatMessages(id) {
  return requestData(`/api/chat/sessions/${encodeURIComponent(id)}/messages`)
}

/** PATCH /api/chat/sessions/:id */
export async function renameBackendChatSession(id, title) {
  return requestData(`/api/chat/sessions/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ title }) })
}

/** DELETE /api/chat/sessions/:id */
export async function deleteBackendChatSession(id) {
  return requestData(`/api/chat/sessions/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

/** POST /api/chat（SSE 流式）；tool_call 为完整单次调用快照。 */
export async function streamChatMessage(payload, { onChunk, onActivity, onToolCall, onComplete, onError, onUi, signal } = {}) {
  try {
    const response = await requestApi('/api/chat', { method: 'POST', body: JSON.stringify(payload), signal })
    if (!response.body) throw new Error('浏览器不支持流式响应')
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let completion = null
    const consumeFrame = frame => {
      const lines = frame.split(/\r?\n/)
      const event = lines.find(line => line.startsWith('event:'))?.slice(6).trim()
      const dataLines = lines.filter(line => line.startsWith('data:')).map(line => line.slice(5).replace(/^ /, ''))
      if (!dataLines.length) return
      const data = JSON.parse(dataLines.join('\n'))
      if (event === 'activity') onActivity?.({ type: 'status', ...data })
      if (event === 'delta') onChunk?.(data.delta)
      if (event === 'tool_call') onToolCall?.(data)
      if (event === 'ui') onUi?.(data)
      if (event === 'done') {
        if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('流式响应的完成事件无效')
        completion = data
      }
      if (event === 'error') throw new Error(data.message || data.error?.message || '模型生成失败')
    }
    try {
      while (true) {
        const { done, value } = await reader.read()
        buffer += done ? decoder.decode() : decoder.decode(value, { stream: true })
        const frames = buffer.split(/\r?\n\r?\n/)
        buffer = frames.pop() || ''
        frames.forEach(consumeFrame)
        if (done) {
          // 容忍最后一个事件没有空行，但不把缺失 done 的断流当成成功。
          if (buffer.trim()) consumeFrame(buffer)
          break
        }
      }
    } finally {
      try { await reader.cancel() } catch { /* 原始读取/协议错误优先 */ }
      reader.releaseLock()
    }
    if (!completion) throw new Error('回复流已中断：未收到完成事件，请重试')
    onActivity?.({ type: 'status', status: 'completed', label: '回答已生成' })
    onComplete?.(completion)
    return completion
  } catch (error) {
    onError?.(error)
    throw error
  }
}

/** POST /api/chat/attachments（multipart，字段名 files） */
// 工具目录 + skills（可扩展：后端新增工具/skill 后前端动态获取）
export async function fetchChatTools() {
  return requestData('/api/chat/tools')
}

export async function uploadChatAttachments(files, signal) {
  const form = new FormData()
  files.forEach(file => form.append('files', file, file.name))
  return (await requestApi('/api/chat/attachments', { method: 'POST', body: form, signal })).json()
}

/** POST /api/chat/feedback */
export async function submitChatFeedback({ conversationId, messageId, rating, reason = null }) {
  return requestData('/api/chat/feedback', {
    method: 'POST',
    body: JSON.stringify({ conversationId, messageId, rating, reason }),
  })
}

/** POST /api/chat/sessions（分支会话） */
export async function createChatSession(payload = {}) {
  return requestData('/api/chat/sessions', { method: 'POST', body: JSON.stringify(payload) })
}

/** GET /api/chat/sessions */
export async function fetchChatSessions() {
  return requestData('/api/chat/sessions')
}

/** PATCH /api/chat/sessions/:id */
export async function renameChatSession(id, title) {
  return requestData(`/api/chat/sessions/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ title }) })
}

/** DELETE /api/chat/sessions/:id */
export async function deleteChatSession(id) {
  return requestData(`/api/chat/sessions/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

// ---------------------------------------------------------------------
// 知识库：学院 / 专业 / 核心课程 / 教材章节
// ---------------------------------------------------------------------
/** GET /api/knowledge/colleges */
export async function fetchColleges() { return requestData('/api/knowledge/colleges') }
/** GET /api/knowledge/colleges/:id */
export async function fetchCollege(id) { return requestData(`/api/knowledge/colleges/${encodeURIComponent(id)}`) }
/** GET /api/knowledge/majors/:id */
export async function fetchMajor(id) { return requestData(`/api/knowledge/majors/${encodeURIComponent(id)}`) }
/** GET /api/knowledge/textbooks */
export async function fetchTextbookGroups() { return requestData('/api/knowledge/textbooks') }

// ---------------------------------------------------------------------
// 求职指南
// ---------------------------------------------------------------------
/** GET /api/guides */
export async function fetchGuides() { return requestData('/api/guides') }
/** GET /api/guides/:id */
export async function fetchGuide(id) { return requestData(`/api/guides/${encodeURIComponent(id)}`) }
/** GET /api/guides/:id/quiz */
export async function fetchQuiz(id) { return requestData(`/api/guides/${encodeURIComponent(id)}/quiz`) }

// ---------------------------------------------------------------------
// 面试
// ---------------------------------------------------------------------
/** GET /api/interview/questions?position=&difficulty= */
export async function fetchQuestions(position, difficulty) { return requestData(`/api/interview/questions?position=${encodeURIComponent(position || '')}&difficulty=${encodeURIComponent(difficulty || '')}`) }
/** POST /api/interview/feedback（一次性维度化反馈） */
export async function fetchInterviewFeedback(position, question, answer, history = []) {
  return requestData('/api/interview/feedback', { method: 'POST', body: JSON.stringify({ position: position || '', question: question || '', answer, history: history.slice(-40) }) })
}
/** POST /api/interview/sessions */
export async function createInterviewSession(config) {
  return requestData('/api/interview/sessions', { method: 'POST', body: JSON.stringify(config) })
}
/** POST /api/interview/sessions/:id/answers */
export async function submitInterviewAnswer(sessionId, payload) {
  return requestData(`/api/interview/sessions/${encodeURIComponent(sessionId)}/answers`, { method: 'POST', body: JSON.stringify(payload) })
}
/** POST /api/interview/sessions/:id/finish */
export async function finishInterviewSession(sessionId) {
  return requestData(`/api/interview/sessions/${encodeURIComponent(sessionId)}/finish`, { method: 'POST', body: JSON.stringify({}) })
}

// ---------------------------------------------------------------------
// 职业辅导与求职画像
// ---------------------------------------------------------------------
/** POST /api/career/jobs/match */
export async function matchJobs(profile) {
  return requestData('/api/career/jobs/match', { method: 'POST', body: JSON.stringify(profile) })
}
/** POST /api/career/star/organize */
export async function organizeStarStory(experience, targetRole = '') {
  return requestData('/api/career/star/organize', { method: 'POST', body: JSON.stringify({ experience, targetRole }) })
}
/** POST /api/career/resume/analyze */
export async function analyzeResume({ text = '', attachmentIds = [] } = {}) {
  return requestData('/api/career/resume/analyze', { method: 'POST', body: JSON.stringify({ text, attachmentIds }) })
}

// ---------------------------------------------------------------------
// 内容审核（管理员）
// ---------------------------------------------------------------------
/** GET /api/review/drafts */
export async function fetchReviewDrafts() { return requestData('/api/review/drafts') }
/** POST /api/review/drafts/:id/decision */
export async function reviewDraft(id, decision, reason = '') {
  return requestData(`/api/review/drafts/${encodeURIComponent(id)}/decision`, {
    method: 'POST',
    body: JSON.stringify({ decision, reason }),
  })
}