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

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
