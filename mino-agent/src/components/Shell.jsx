import { useEffect, useRef, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { useUiStore } from '../store.js'
import Sidebar from './Sidebar.jsx'
import '../styles/chat-ux.css'

export default function Shell() {
  const collapsed = useUiStore(s => s.sidebarCollapsed)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [smallScreen, setSmallScreen] = useState(() => window.matchMedia('(max-width: 760px)').matches)
  const location = useLocation()
  const drawerRef = useRef(null)
  const triggerRef = useRef(null)
  const closeDrawer = () => { setDrawerOpen(false); triggerRef.current?.focus() }
  useEffect(() => {
    const media = window.matchMedia('(max-width: 760px)')
    const update = () => { setSmallScreen(media.matches); setDrawerOpen(false) }
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])
  useEffect(() => { setDrawerOpen(false) }, [location.pathname, location.search])
  useEffect(() => {
    if (!drawerOpen || !smallScreen) return
    const previous = document.activeElement
    const drawer = drawerRef.current
    drawer?.querySelector('button, a')?.focus()
    const onKey = event => {
      if (event.key === 'Escape') { event.preventDefault(); setDrawerOpen(false); return }
      if (event.key !== 'Tab') return
      const controls = [...drawer.querySelectorAll('button:not(:disabled), a[href], [tabindex="0"]')].filter(el => el.getClientRects().length)
      const first = controls[0], last = controls[controls.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('keydown', onKey); previous?.focus?.() }
  }, [drawerOpen, smallScreen])
  return (
    <div className={`frame uxShell${drawerOpen ? ' navDrawerOpen' : ''}`} style={{ '--shell-sidebar-width': collapsed ? '56px' : '280px' }}>
      {smallScreen && drawerOpen && <button className="navDrawerBackdrop" aria-label="关闭导航" tabIndex={-1} onClick={closeDrawer} />}
      <div className="sidebarCol" id="shell-navigation" ref={drawerRef} role={smallScreen && drawerOpen ? 'dialog' : undefined} aria-modal={smallScreen && drawerOpen ? true : undefined} aria-label="应用导航">
        <Sidebar mobile={smallScreen} onNavigate={() => setDrawerOpen(false)} onClose={closeDrawer} />
      </div>
      <div className="centerCol" inert={smallScreen && drawerOpen ? '' : undefined}>
        <header className="shellMobileBar"><button ref={triggerRef} className="btn ghost sm" aria-label="打开导航菜单" aria-expanded={drawerOpen} aria-controls="shell-navigation" onClick={() => setDrawerOpen(true)}>☰ 导航</button><span>MINO AGENT</span></header>
        <Outlet />
      </div>
    </div>
  )
}
