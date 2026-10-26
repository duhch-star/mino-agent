import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuthStore } from '../store.js'
import { Brand } from '../components/Brand.jsx'

export default function Login() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const returnTo = params.get('returnTo')
  const authStatus = useAuthStore(s => s.status)
  const login = useAuthStore(s => s.login)
  const [role, setRole] = useState('user')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const enterGuest = useAuthStore(s => s.enterGuest)

  const submit = async () => {
    if (pending) return
    setPending(true)
    setError('')
    try {
      const user = await login(name.trim(), password, role)
      navigate(returnTo?.startsWith('/') && !returnTo.startsWith('//') && !returnTo.startsWith('/login') ? returnTo : user.role === 'admin' ? '/review' : '/home')
    } catch (loginError) {
      setError(loginError.message || '登录失败')
    } finally { setPending(false) }
  }

  return (
    <div className="onboarding">
      <div className="onboardingBrand">
        <Brand size={40} />
      </div>

      <div className="onboardingCard loginCard">
        <h1>登录 MINO AGENT</h1>
        <p className="pageSub">使用已注册账号登录。游客数据独立保留，不会自动导入账号；角色以服务端授权为准。</p>

        {/* 角色选择：求职者 / 管理员 */}
        <div className="loginTabs">
          <button className={`loginTab${role === 'user' ? ' on' : ''}`} onClick={() => setRole('user')}>求职者</button>
          <button className={`loginTab${role === 'admin' ? ' on' : ''}`} onClick={() => setRole('admin')}>管理员</button>
        </div>

        <div className="onboardingField">
          <div className="sectionTitle">账号</div>
          <input
            className="searchInput"
            placeholder={role === 'admin' ? '管理员账号' : '手机号 / 邮箱 / 用户名'}
            value={name}
            onChange={e => setName(e.target.value)}
          />
        </div>
        <div className="onboardingField">
          <div className="sectionTitle">密码</div>
          <input
            className="searchInput"
            type="password"
            placeholder="密码"
            value={password}
            onChange={e => setPassword(e.target.value)}
          />
        </div>

        {(error || authStatus === 'expired' || params.has('expired')) && <p role="alert" className="loginError">{error || '登录已失效，请重新登录。游客数据仍独立保留。'}</p>}

        <div className="onboardingActions">
          <button className="btn ghost" onClick={() => { enterGuest(); navigate('/onboarding') }}>游客模式</button>
          <button className="btn primary" onClick={submit} disabled={pending || !name.trim() || !password.trim()}>{pending ? '登录中…' : '登录'}</button>
        </div>
      </div>
    </div>
  )
}
