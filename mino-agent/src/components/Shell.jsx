import { Outlet } from 'react-router-dom'
import { useUiStore } from '../store.js'
import Sidebar from './Sidebar.jsx'

// 带侧边栏的应用外壳（复刻 AppFrame 三列栅格，这里简化为侧边栏 + 内容两列）
export default function Shell() {
  const collapsed = useUiStore(s => s.sidebarCollapsed)

  return (
    <div
      className="frame"
      style={{ gridTemplateColumns: collapsed ? '56px minmax(0, 1fr)' : '280px minmax(0, 1fr)' }}
    >
      <div className="sidebarCol">
        <Sidebar />
      </div>
      <div className="centerCol">
        <Outlet />
      </div>
    </div>
  )
}
