import { create } from 'zustand'
import { setInterviewChatContext } from '../../lib/interview-chat-context'
import { positions, difficulties, durations } from './data/interview.js'
import { fetchLearningState, saveLearningState } from './api.js'

// Account-owned business state. No legacy demo chat, JWT or shared persisted cache.
export const useAuthStore = create(() => ({ user: null, status: 'unverified' }))
export const useChatStore = create(() => ({
  setContext: context => window.dispatchEvent(new CustomEvent('minos:compose', { detail: { text: `请结合「${context.title}」解释以下内容：\n${context.snippet}` } })),
}))
const blankLearning = () => ({ profile: { direction: '', level: '' }, bookmarks: [], progress: {}, notes: {}, quizResults: {} })
let epoch = 0
let timer
function sync() {
  clearTimeout(timer)
  const current = epoch
  timer = setTimeout(() => {
    if (current !== epoch || !useAuthStore.getState().user) return
    const { progress, bookmarks, notes, quizResults } = useLearningStore.getState()
    saveLearningState({ progress, bookmarks, notes, quizResults }).catch(error => useLearningStore.setState({ syncError: error.message }))
  }, 800)
}
export const useLearningStore = create(set => ({
  ...blankLearning(), syncError: '',
  setProfile: profile => { set({ profile }); sync() },
  toggleBookmark: id => { set(s => ({ bookmarks: s.bookmarks.includes(id) ? s.bookmarks.filter(x => x !== id) : [...s.bookmarks, id] })); sync() },
  setProgress: (id, value) => { set(s => ({ progress: { ...s.progress, [id]: value } })); sync() },
  setNote: (id, text) => { set(s => ({ notes: { ...s.notes, [id]: text } })); sync() },
  setQuizResult: (id, score, total) => { set(s => ({ quizResults: { ...s.quizResults, [id]: { score, total } } })); sync() },
}))
const blankInterview = () => ({ feedbackModel: null, feedbackCwd: null, phase: 'config', position: positions[0], difficulty: difficulties[0], mode: 'text', duration: durations[1], questions: [], index: 0, transcript: [], stage: 'asking', micOn: false, followup: null, paused: false, messages: [], answerError: '', sessionId: null, finishing: false, finished: false, serverReport: null })
export const useInterviewStore = create(set => ({
  ...blankInterview(),
  start: () => set(s => ({ phase: 'running', stage: 'asking', messages: [{ role: 'assistant', text: s.questions[s.index] || '', time: Date.now() }], answerError: '' })),
  setMic: micOn => set({ micOn }), setMode: mode => set({ mode }),
  togglePause: () => set(s => ({ paused: !s.paused })),
  reset: () => set(blankInterview()),
}))
export async function activateAccount(user) {
  setInterviewChatContext(null)
  const current = ++epoch
  clearTimeout(timer)
  useAuthStore.setState({ user, status: user ? 'authenticated' : 'guest' })
  useLearningStore.setState({ ...blankLearning(), syncError: '' })
  useInterviewStore.getState().reset()
  if (user) {
    try { const state = await fetchLearningState(); if (current === epoch) useLearningStore.setState({ ...blankLearning(), ...state }) }
    catch (error) { if (current === epoch) useLearningStore.setState({ syncError: error.message }) }
  }
}
