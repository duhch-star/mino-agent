import React from 'react'
import ReactDOM from 'react-dom/client'

// 设计系统样式（原样拷贝自 deepseek-harness ui-theme，加载顺序不可调换）
import './styles/theme/design-platform.css'
import './styles/theme/base.css'
import './styles/theme/corner-shape.css'
import './styles/theme/focus.css'
import './styles/theme/scrollbar.css'
import './styles/theme/gradient-shadow-text.css'
import './styles/theme/onboarding.css'
import './styles/theme/brand-font.css'
import './styles/theme/shiki.css'

// 复刻层自身的全局样式（重置 + 应用外壳 + 各业务模块）
import './styles/global.css'
import './styles/app.css'
import './styles/pages.css'

import App from './App.jsx'

// 全局错误捕获：渲染崩溃时把错误写入 #root，便于定位
window.addEventListener('error', e => {
  const el = document.getElementById('dsh-error-box')
  if (el) el.textContent += `\n[error] ${e.error?.stack || e.message}`
})
window.addEventListener('unhandledrejection', e => {
  const el = document.getElementById('dsh-error-box')
  if (el) el.textContent += `\n[unhandledrejection] ${e.reason?.stack || e.reason}`
})

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }
  static getDerivedStateFromError(error) {
    return { error }
  }
  componentDidCatch(error, info) {
    const box = document.getElementById('dsh-error-box')
    if (box) box.textContent += `\n[caught] ${error.stack || error}\n${info.componentStack || ''}`
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 20, fontFamily: 'monospace', whiteSpace: 'pre-wrap', background: '#fff', color: '#c00', minHeight: '100vh' }}>
          <div>渲染崩溃：</div>
          <div id="dsh-error-box">{String(this.state.error.stack || this.state.error)}</div>
          <button onClick={() => this.setState({ error: null })}>重试</button>
        </div>
      )
    }
    return this.props.children
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
)
