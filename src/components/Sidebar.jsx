import { NavLink, useNavigate } from 'react-router-dom'
import { useUiStore, useChatStore, useAuthStore } from '../store.js'
import { Brand } from './Brand.jsx'
import { IconNewChat, IconPanel, IconSettings, IconHome, IconBook, IconMic, IconBriefcase, IconChat, IconShield } from './Icons.jsx'

const NAV = [
  { to: '/home', label: '首页', icon: IconHome },
  { to: '/knowledge', label: '知识库', icon: IconBook },
  { to: '/interview', label: 'AI 面试', icon: IconMic },
  { to: '/career', label: '职业辅导', icon: IconBriefcase },
  { to: '/chat', label: '对话助手', icon: IconChat },
]

export default function Sidebar() {
  const collapsed = useUiStore(s => s.sidebarCollapsed)
  const toggleSidebar = useUiStore(s => s.toggleSidebar)
  const openSettings = useUiStore(s => s.openSettings)
  const newSession = useChatStore(s => s.newSession)
  const sessions = useChatStore(s => s.sessions)
  const activeId = useChatStore(s => s.activeId)
  const selectSession = useChatStore(s => s.selectSession)
  const navigate = useNavigate()
  const user = useAuthStore(s => s.user)
  const navItems = user?.role === 'admin'
    ? [...NAV, { to: '/review', label: '内容审核', icon: IconShield }]
    : NAV

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
        {sessions.map(s => (
          <button
            key={s.id}
            className={`sessionRow${s.id === activeId ? ' sessionActive' : ''}`}
            onClick={() => { selectSession(s.id); navigate('/chat') }}
          >
            <span className="sessionTitle">{s.title}</span>
          </button>
        ))}
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
