import { useEffect } from 'react'
import { HashRouter, Routes, Route } from 'react-router-dom'
import { useUiStore } from './store.js'
import Shell from './components/Shell.jsx'
import Settings from './pages/Settings.jsx'
import Welcome from './pages/Welcome.jsx'
import Onboarding from './pages/Onboarding.jsx'
import Login from './pages/Login.jsx'
import Home from './pages/Home.jsx'
import Knowledge from './pages/Knowledge.jsx'
import ChapterReader from './pages/ChapterReader.jsx'
import Interview from './pages/Interview.jsx'
import InterviewRoom from './pages/InterviewRoom.jsx'
import Career from './pages/Career.jsx'
import ChatApp from './pages/ChatApp.jsx'
import Review from './pages/Review.jsx'

export default function App() {
  const dark = useUiStore(s => s.dark)
  const fontSize = useUiStore(s => s.fontSize)
  const settingsOpen = useUiStore(s => s.settingsOpen)

  // 明暗主题：绑定 body[data-ds-dark-theme]，设计令牌据此翻转
  useEffect(() => {
    document.body.toggleAttribute('data-ds-dark-theme', dark)
  }, [dark])

  // 内容字号：写入 --dsh-content-font-size，全界面文字实时缩放
  useEffect(() => {
    document.body.style.setProperty('--dsh-content-font-size', `${fontSize}px`)
    return () => document.body.style.removeProperty('--dsh-content-font-size')
  }, [fontSize])

  return (
    <>
      <HashRouter>
        <Routes>
          {/* 全屏页（无侧边栏） */}
          <Route path="/" element={<Welcome />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/login" element={<Login />} />
          <Route path="/interview/room" element={<InterviewRoom />} />

          {/* 带侧边栏的壳 */}
          <Route element={<Shell />}>
            <Route path="/home" element={<Home />} />
            <Route path="/knowledge" element={<Knowledge />} />
            <Route path="/knowledge/:id" element={<ChapterReader />} />
            <Route path="/interview" element={<Interview />} />
            <Route path="/career" element={<Career />} />
            <Route path="/chat" element={<ChatApp />} />
            <Route path="/review" element={<Review />} />
          </Route>
        </Routes>
      </HashRouter>

      {/* 全局设置浮层 */}
      {settingsOpen && <Settings />}
    </>
  )
}
