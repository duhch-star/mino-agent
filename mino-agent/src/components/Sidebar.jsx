import { useEffect, useRef, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useUiStore, useChatStore, useAuthStore } from '../store.js'
import { Brand } from './Brand.jsx'
import { IconNewChat, IconPanel, IconSettings, IconHome, IconBook, IconMic, IconBriefcase, IconChat, IconShield, IconMore, IconEdit, IconBranch, IconTrash } from './Icons.jsx'

const NAV = [
  { to: '/home', label: '首页', icon: IconHome },
  { to: '/knowledge', label: '知识库', icon: IconBook },
  { to: '/interview', label: 'AI 面试', icon: IconMic },
  { to: '/career', label: '职业辅导', icon: IconBriefcase },
  { to: '/resume', label: 'LaTeX 简历', icon: IconEdit },
  { to: '/chat', label: '对话助手', icon: IconChat },
]

export default function Sidebar() {
  const collapsed = useUiStore(s => s.sidebarCollapsed)
  const toggleSidebar = useUiStore(s => s.toggleSidebar)
  const openSettings = useUiStore(s => s.openSettings)
  const newSession = useChatStore(s => s.newSession)
  const sessions = useChatStore(s => s.sessions)
  const conversations = useChatStore(s => s.conversations)
  const activeId = useChatStore(s => s.activeId)
  const selectSession = useChatStore(s => s.selectSession)
  const renameSession = useChatStore(s => s.renameSession)
  const deleteSession = useChatStore(s => s.deleteSession)
  const branchConversation = useChatStore(s => s.branchConversation)
  const [openMenu, setOpenMenu] = useState(null)
  const menuRef = useRef(null)
  const navigate = useNavigate()
  const user = useAuthStore(s => s.user)
  const navItems = user?.role === 'admin'
    ? [...NAV, { to: '/review', label: '内容审核', icon: IconShield }]
    : NAV

  useEffect(() => {
    const closeOnOutside = event => {
      if (!menuRef.current?.contains(event.target)) setOpenMenu(null)
    }
    const closeOnEscape = event => { if (event.key === 'Escape') setOpenMenu(null) }
    document.addEventListener('pointerdown', closeOnOutside)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutside)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [])

  const toggleSessionMenu = (event, sessionId) => {
    event.stopPropagation()
    if (openMenu?.id === sessionId) {
      setOpenMenu(null)
      return
    }
    const rect = event.currentTarget.getBoundingClientRect()
    setOpenMenu({
      id: sessionId,
      top: Math.max(8, Math.min(rect.bottom + 4, window.innerHeight - 158)),
      left: Math.max(8, Math.min(rect.right - 204, window.innerWidth - 212)),
    })
  }

  const handleRename = session => {
    const title = window.prompt('重命名对话', session.title)
    if (title !== null && title.trim()) renameSession(session.id, title)
    setOpenMenu(null)
  }

  const handleBranch = sessionId => {
    const messages = conversations[sessionId] || []
    const latestAssistant = [...messages].reverse().find(message => message.role === 'assistant')
    if (latestAssistant) {
      branchConversation(sessionId, latestAssistant.id)
      navigate('/chat')
    }
    setOpenMenu(null)
  }

  const handleDelete = session => {
    if (window.confirm(`确定删除“${session.title}”及其中的全部消息吗？此操作无法撤销。`)) {
      deleteSession(session.id)
      if (session.id === activeId) navigate('/chat')
    }
    setOpenMenu(null)
  }

  return (
    <div className={`sidebar${collapsed ? ' collapsed' : ''}`}>
      {/* 品牌 Logo + 面板折叠开关 */}
      <div className="logoRow">
        <button className="brand" onClick={() => navigate('/home')} aria-label="返回首页">
          <Brand size={24} />
        </button>
        <button className="iconButton" onClick={toggleSidebar} aria-label={collapsed ? '展开侧边栏' : '折叠侧边栏'}>
          <IconPanel size={16} />
        </button>
      </div>

      {/* 新建对话 */}
      <button
        className="newSession"
        onClick={() => { newSession(); navigate('/chat') }}
      >
        <IconNewChat size={14} />
        <span>新对话</span>
      </button>

      {/* 模块导航 */}
      <nav className="panelList">
        {navItems.map(n => {
          const I = n.icon
          return (
            <NavLink
              key={n.to}
              to={n.to}
              className={({ isActive }) => `panelRow${isActive ? ' panelActive' : ''}`}
            >
              <span aria-hidden="true"><I size={16} /></span>
              <span className="panelTitle">{n.label}</span>
            </NavLink>
          )
        })}
      </nav>

      {/* 最近会话（对话助手的历史记录） */}
      <div className="sessionList">
        {sessions.map(session => {
          const latestAssistant = [...(conversations[session.id] || [])].reverse().find(message => message.role === 'assistant')
          return (
            <div key={session.id} className={`sessionRow${session.id === activeId ? ' sessionActive' : ''}`}>
              <button className="sessionSelect" onClick={() => { setOpenMenu(null); selectSession(session.id); navigate('/chat') }}>
                <span className="sessionTitle">{session.title}</span>
              </button>
              <button className="sessionMore" onClick={event => toggleSessionMenu(event, session.id)} aria-label={`“${session.title}”的更多操作`} aria-haspopup="menu" aria-expanded={openMenu?.id === session.id}>
                <IconMore size={16} />
              </button>
              {openMenu?.id === session.id && <div className="sessionMenu" ref={menuRef} role="menu" style={{ top: openMenu.top, left: openMenu.left }}>
                <button role="menuitem" onClick={() => handleRename(session)}><IconEdit size={15} />重命名</button>
                <button role="menuitem" onClick={() => handleBranch(session.id)} disabled={!latestAssistant}><IconBranch size={15} />分支会话</button>
                <button role="menuitem" className="danger" onClick={() => handleDelete(session)}><IconTrash size={15} />删除对话</button>
              </div>}
            </div>
          )
        })}
      </div>

      {/* 底部设置入口 */}
      <div className="footArea">
        {user ? (
          <button className="accountBtn" onClick={openSettings}>
            <span className="accountAvatar">{user.name.slice(0, 1)}</span>
            <span className="accountName">{user.name}</span>
            <span className="accountRole">{user.role === 'admin' ? '管理员' : '求职者'}</span>
          </button>
        ) : (
          <NavLink to="/login" className="accountBtn">
            <span className="accountAvatar">?</span>
            <span className="accountName">未登录</span>
          </NavLink>
        )}
        <button className="settingsBtn" onClick={openSettings}>
          <span aria-hidden="true"><IconSettings size={16} /></span>
          <span>设置</span>
        </button>
      </div>
    </div>
  )
}
