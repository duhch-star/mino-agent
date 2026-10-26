import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store.js'
import { launchPiWeb } from '../api.js'
import '../styles/pi-business.css'

const allowedPath = path => typeof path === 'string' && /^\/(?:home|knowledge(?:\/[^?#]*)?|guide\/[^?#]+|interview(?:\/room)?|career|review|chat(?:-legacy)?|resume(?:-legacy)?)(?:[?#].*)?$/.test(path)
const businessView = path => path.startsWith('/knowledge') || path.startsWith('/guide/') ? 'knowledge' : path.startsWith('/interview') ? 'interview' : ['home', 'career', 'review'].find(view => path === `/${view}`) || 'chat'

/** Keep one ticket-consuming iframe alive across all business route changes. */
export default function PiWebWorkspace() {
  const userId = useAuthStore(s => s.user?.id)
  const status = useAuthStore(s => s.status)
  const location = useLocation()
  const navigate = useNavigate()
  const iframe = useRef(null)
  const pending = useRef(null)
  const [attempt, setAttempt] = useState({ owner: null, number: 0, acknowledge: false })
  const [connection, setConnection] = useState({ owner: null, url: '', error: '', permission: false })
  const businessPath = `${location.pathname}${location.search}${location.hash}`
  const currentPath = useRef(businessPath)
  currentPath.current = businessPath
  const url = connection.owner === userId ? connection.url : ''
  const sidecarOrigin = url ? new URL(url).origin : ''
  const sendHost = useCallback(() => {
    if (!sidecarOrigin) return
    iframe.current?.contentWindow?.postMessage({ type: 'minos:host', origin: window.location.origin, path: currentPath.current }, sidecarOrigin)
  }, [sidecarOrigin])

  useEffect(() => {
    if (status === 'guest' || status === 'expired') {
      navigate(`/login?returnTo=${encodeURIComponent(currentPath.current)}`, { replace: true })
    }
  }, [status, navigate])

  useEffect(() => {
    if (userId == null) {
      pending.current = null
      setConnection({ owner: null, url: '', error: '', permission: false })
      return
    }
    if (status !== 'authenticated') return
    let active = true
    const number = attempt.owner === userId ? attempt.number : 0
    const acknowledge = attempt.owner === userId && attempt.acknowledge
    // Reuse the promise in StrictMode / auth revalidation; never silently restart.
    if (!pending.current || pending.current.owner !== userId || pending.current.number !== number) {
      pending.current = { owner: userId, number, promise: launchPiWeb(acknowledge) }
    }
    setConnection(previous => previous.owner === userId && previous.url ? previous : { owner: userId, url: '', error: '', permission: false })
    const request = pending.current
    request.promise.then(data => {
      if (!active || useAuthStore.getState().user?.id !== userId) return
      if (!request.url) {
        const launched = new URL(data.url)
        if (!['http:', 'https:'].includes(launched.protocol)) throw new Error('工作区返回了无效地址')
        launched.searchParams.set('view', businessView(currentPath.current.split(/[?#]/)[0]))
        launched.searchParams.set('businessPath', currentPath.current)
        request.url = launched.href
      }
      setConnection({ owner: userId, url: request.url, error: '', permission: false })
    }).catch(error => {
      if (!active || useAuthStore.getState().user?.id !== userId) return
      setConnection({ owner: userId, url: '', error: error.status === 409 ? '' : (error.message || '工作区连接失败，请重试'), permission: error.status === 409 })
      if (error.status === 401) navigate(`/login?returnTo=${encodeURIComponent(currentPath.current)}`, { replace: true })
    })
    return () => { active = false }
  }, [userId, status, attempt, navigate])

  useEffect(() => {
    if (!sidecarOrigin) return
    const receive = event => {
      if (event.origin !== sidecarOrigin || event.source !== iframe.current?.contentWindow) return
      if (event.data?.type === 'minos:host-ready') sendHost()
      if (event.data?.type === 'minos:navigate' && allowedPath(event.data.path)) navigate(event.data.path)
    }
    window.addEventListener('message', receive)
    return () => window.removeEventListener('message', receive)
  }, [sidecarOrigin, navigate, sendHost])
  useEffect(() => { sendHost() }, [businessPath, sendHost])

  const retry = acknowledge => setAttempt(previous => ({ owner: userId, number: previous.owner === userId ? previous.number + 1 : 1, acknowledge }))
  const own = connection.owner === userId
  return <main className="piWorkspace">
    {url ? <iframe ref={iframe} title="MINOS Pi 工作区" src={url} onLoad={sendHost} allow="microphone; camera; clipboard-read; clipboard-write; fullscreen" /> : <>
      <div className="piWorkspaceSkeleton" aria-hidden="true"><aside><b>π</b><span /><span /><span /></aside><section><header>MINOS <span>工作区</span></header><div className="piSkeletonContent"><i /><i /><i /></div></section></div>
      {own && connection.permission ? <div className="piPermissionBackdrop"><section className="piPermissionDialog" role="dialog" aria-modal="true" aria-labelledby="pi-permission-title" aria-describedby="pi-permission-description">
        <h1 id="pi-permission-title">允许本机智能体访问？</h1><p id="pi-permission-description">Pi 可以按你的指令读取、修改本机文件并执行命令，不是文件沙箱。账号独立保存会话与配置，但仍使用当前系统账号权限。请只运行你信任的指令与插件。</p><p>原聊天和简历数据仍保留在旧工作区，不会自动迁移或删除。</p><footer><button onClick={() => navigate('/chat-legacy')}>暂不启用</button><button className="piConfirm" autoFocus onClick={() => retry(true)}>我了解，允许并继续</button></footer>
      </section></div> : <div className="piWorkspaceStatus" role={own && connection.error ? 'alert' : 'status'}>{own && connection.error ? <><p>{connection.error}</p><button onClick={() => retry(false)}>重新连接</button></> : <p>{status === 'error' ? '请先恢复登录连接，再打开工作区。' : '正在连接工作区…'}</p>}</div>}
    </>}
  </main>
}
