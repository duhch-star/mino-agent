import { useEffect, useRef, useState } from 'react'
import { HashRouter, Routes, Route, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useUiStore, useAuthStore } from './store.js'
import { AUTH_EXPIRED_EVENT } from './api.js'
import './styles/auth-recovery.css'
import './styles/pi-knowledge.css'
import Shell from './components/Shell.jsx'
import Settings from './pages/Settings.jsx'
import Onboarding from './pages/Onboarding.jsx'
import Login from './pages/Login.jsx'
import Home from './pages/Home.jsx'
import Knowledge from './pages/Knowledge.jsx'
import CollegePage from './pages/CollegePage.jsx'
import MajorPage from './pages/MajorPage.jsx'
import ChapterReader from './pages/ChapterReader.jsx'
import Interview from './pages/Interview.jsx'
import InterviewRoom from './pages/InterviewRoom.jsx'
import Career from './pages/Career.jsx'
import ChatApp from './pages/ChatApp.jsx'
import PiWebWorkspace from './pages/PiWebWorkspace.jsx'
import Review from './pages/Review.jsx'

/** 全局监听 GenUI「去补课」跳转（由 GenUI 组件 dispatch genui:goto 事件触发） */
function GenUiNavigator() {
  const navigate = useNavigate()
  useEffect(() => {
    const handler = (event) => {
      const chapterId = event.detail?.chapterId
      if (chapterId) navigate(`/guide/${chapterId}`)
    }
    window.addEventListener('genui:goto', handler)
    return () => window.removeEventListener('genui:goto', handler)
  }, [navigate])
  return null
}

function AuthLifecycle() {
  const navigate = useNavigate()
  const navigateRef = useRef(navigate)
  navigateRef.current = navigate
  const authStatus = useAuthStore(s => s.status)
  const authError = useAuthStore(s => s.error)
  useEffect(() => {
    const expired = () => {
      const returnTo = window.location.hash.slice(1) || '/home'
      navigateRef.current(`/login?expired=1&returnTo=${encodeURIComponent(returnTo)}`, { replace: true })
    }
    window.addEventListener(AUTH_EXPIRED_EVENT, expired)
    useAuthStore.getState().validateCurrentUser().catch(() => {})
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, expired)
  }, [])
  if (authStatus !== 'error') return null
  return <div role="alert" className="authRecoveryBanner"><span>{authError || '暂时无法验证登录状态，请检查连接后重试。'}</span><button className="btn outline sm" onClick={() => useAuthStore.getState().validateCurrentUser()}>重新连接</button><button className="btn ghost sm" onClick={() => { useAuthStore.getState().enterGuest(); navigate('/home') }}>使用游客模式</button></div>
}

const piEmbed = new URLSearchParams(window.location.search).get('piEmbed') === '1' || window.location.hash.startsWith('#/embedded/')
const businessPaths = ['home', 'knowledge', 'knowledge/college/:cid', 'knowledge/major/:mid', 'guide/:id', 'interview', 'interview/room', 'career', 'review']
const businessPages = [Home, Knowledge, CollegePage, MajorPage, ChapterReader, Interview, InterviewRoom, Career, Review]

/** Real MINOS pages, without the old Shell; legacy absolute Links remain local. */
function PiBusinessFrame() {
  const location = useLocation()
  const navigate = useNavigate()
  const [dark, setDark] = useState(false)
  const path = `${location.pathname.replace(/^\/embedded(?=\/)/, '')}${location.search}${location.hash}`
  const peerOrigin = (() => {
    try { return new URL(document.referrer).origin } catch { return '' }
  })()
  useEffect(() => {
    document.body.classList.add('piBusinessDocument')
    return () => document.body.classList.remove('piBusinessDocument')
  }, [])
  useEffect(() => {
    if (window.parent !== window && peerOrigin) window.parent.postMessage({ type: 'minos:business-navigate', path }, peerOrigin)
  }, [path, peerOrigin])
  useEffect(() => {
    const receive = event => {
      if (event.source !== window.parent || !peerOrigin || event.origin !== peerOrigin) return
      if (event.data?.type === 'minos:theme' && typeof event.data.dark === 'boolean') setDark(event.data.dark)
      if (event.data?.type === 'minos:business-route' && typeof event.data.path === 'string' && /^\/(knowledge(?:\/(?:college|major)\/[a-zA-Z0-9_-]+)?|guide\/[a-zA-Z0-9_-]+|interview(?:\/room)?|review)$/.test(event.data.path) && window.location.hash.slice(1) !== event.data.path) navigate(event.data.path, {replace:true})
    }
    // Plain same-origin hash anchors are supported as well as react-router Links.
    const click = event => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      const anchor = event.target.closest?.('a[href]')
      if (!anchor || anchor.download || (anchor.target && anchor.target !== '_self')) return
      const url = new URL(anchor.href, window.location.href)
      const target = url.hash.slice(1)
      if (url.origin === window.location.origin && /^\/(?:embedded\/)?(?:home|knowledge|guide|interview|career|review|chat|resume)(?:[/?#]|$)/.test(target)) {
        event.preventDefault()
        navigate(target)
      }
    }
    window.addEventListener('message', receive)
    document.addEventListener('click', click)
    return () => { window.removeEventListener('message', receive); document.removeEventListener('click', click) }
  }, [peerOrigin, navigate])
  return <div className="piBusinessTheme" data-pi-dark={dark ? 'true' : 'false'}><Outlet /></div>
}

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
        <GenUiNavigator />
        <AuthLifecycle />
        <Routes>
          {/* 全屏页（无侧边栏） */}
          <Route path="/" element={<Navigate to="/chat" replace />} />
          {!piEmbed && <Route path="/home" element={<Navigate to="/chat" replace />} />}
          {!piEmbed && <Route path="/career" element={<Navigate to="/chat" replace />} />}
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/login" element={<Login />} />
          {/* One route instance preserves the Pi iframe and its one-use launch ticket. */}
          {!piEmbed && <Route path="/*" element={<PiWebWorkspace />} />}

          <Route element={<PiBusinessFrame />}>
            {businessPaths.map((path, index) => {
              const Page = businessPages[index]
              return <Route key={`embedded-${path}`} path={`/embedded/${path}`} element={<Page />} />
            })}
            {piEmbed && businessPaths.map((path, index) => {
              const Page = businessPages[index]
              return <Route key={path} path={`/${path}`} element={<Page />} />
            })}
            {piEmbed && <Route path="/chat" element={<div className="piBusinessSwitch" role="status">正在切换到对话…</div>} />}
            {piEmbed && <Route path="/resume" element={<div className="piBusinessSwitch" role="status">正在切换到简历工作区…</div>} />}
          </Route>

          {/* Explicit legacy routes keep their previous UI and data. */}
          <Route element={piEmbed ? <PiBusinessFrame /> : <Shell />}>
            <Route path="/resume-legacy" element={<ChatApp resume />} />
            <Route path="/chat-legacy" element={<ChatApp />} />
          </Route>
        </Routes>

        {/* 全局设置浮层（必须在 Router 内，Settings 使用 useNavigate） */}
        {settingsOpen && <Settings />}
      </HashRouter>
    </>
  )
}
