import { readFeedbackStream } from './lib/feedback-stream.mjs'
// Same-origin business API. JWT/refresh credentials stay in the Next server.
export const AUTH_EXPIRED_EVENT = 'mino:auth-expired'
export async function requestApi(path, options = {}) {
  const headers = new Headers(options.headers)
  if (options.body && !(options.body instanceof FormData)) headers.set('Content-Type', 'application/json')
  const response = await fetch(`/api/business${path.replace(/^\/api/, '')}`, { ...options, headers })
  if (response.status === 401) globalThis.dispatchEvent?.(new CustomEvent(AUTH_EXPIRED_EVENT))
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data.error?.message || (typeof data.detail === 'string' ? data.detail : '') || `请求失败 (${response.status})`)
  }
  return response
}
const data = async (path, options) => (await requestApi(path, options)).json()
export const fetchCurrentUser = () => data('/api/users/me')
export const fetchUsageSummary = () => data('/api/usage/me')
export const fetchLearningState = () => data('/api/users/me/learning')
export const saveLearningState = state => data('/api/users/me/learning', { method: 'PUT', body: JSON.stringify(state) })
export const saveUserProfile = profile => data('/api/users/me/profile', { method: 'PUT', body: JSON.stringify(profile) })
export const fetchGuides = () => data('/api/guides')
export const fetchGuide = id => data(`/api/guides/${encodeURIComponent(id)}`)
export const fetchQuiz = id => data(`/api/guides/${encodeURIComponent(id)}/quiz`)
export const fetchColleges = () => data('/api/knowledge/colleges')
export const fetchCollege = id => data(`/api/knowledge/colleges/${encodeURIComponent(id)}`)
export const fetchMajor = id => data(`/api/knowledge/majors/${encodeURIComponent(id)}`)
export const fetchTextbookGroups = () => data('/api/knowledge/textbooks')
export const fetchQuestions = (position, difficulty) => data(`/api/interview/questions?position=${encodeURIComponent(position || '')}&difficulty=${encodeURIComponent(difficulty || '')}`)
export const createInterviewSession = config => data('/api/interview/sessions', { method: 'POST', body: JSON.stringify(config) })
export const submitInterviewAnswer = (id, payload) => data(`/api/interview/sessions/${encodeURIComponent(id)}/answers`, { method: 'POST', body: JSON.stringify(payload) })
export const finishInterviewSession = id => data(`/api/interview/sessions/${encodeURIComponent(id)}/finish`, { method: 'POST', body: '{}' })
async function requestPiInterview(path, options = {}) {
  const response = await fetch(`/api/interview/${path}`, { ...options, headers: { 'Content-Type': 'application/json' } })
  if (response.status === 401) globalThis.dispatchEvent?.(new CustomEvent(AUTH_EXPIRED_EVENT))
  if (!response.ok) { const data = await response.json().catch(() => ({})); throw new Error(typeof data.error === 'string' ? data.error : `Pi 模型请求失败 (${response.status})`) }
  return response
}
export const fetchInterviewModels = async (signal, cwd) => (await requestPiInterview(`models${cwd ? `?cwd=${encodeURIComponent(cwd)}` : ''}`, { signal })).json()
export async function fetchInterviewFeedback(position, question, answer, history = [], options = {}) {
  const signal = options.signal || AbortSignal.timeout(30000)
  const response = await requestPiInterview('feedback/stream', { method: 'POST', body: JSON.stringify({ position, question, answer, history: history.slice(-40), model: options.model || null, cwd: options.cwd || undefined }), signal })
  return readFeedbackStream(response, { onPreview: options.onPreview, signal })
}
export const fetchInterviewSpeechConfig = signal => data('/api/interview/speech/config', { signal })
export async function generateInterviewSpeech(text, signal) { return (await requestApi('/api/interview/speech', { method: 'POST', body: JSON.stringify({ text }), signal })).blob() }
export const fetchReviewDrafts = () => data('/api/review/drafts')
export const reviewDraft = (id, decision, reason = '') => data(`/api/review/drafts/${encodeURIComponent(id)}/decision`, { method: 'POST', body: JSON.stringify({ decision, reason }) })
