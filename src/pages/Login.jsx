import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store.js'
import { Brand } from '../components/Brand.jsx'

export default function Login() {
  const navigate = useNavigate()
  const login = useAuthStore(s => s.login)
  const [role, setRole] = useState('user')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')

  const submit = async () => {
    await login(name.trim(), password, role)
    navigate(role === 'admin' ? '/review' : '/home')
  }

  return (
    <div className="onboarding">
      <div className="onboardingBrand">
        <Brand size={40} />
      </div>

      <div className="onboardingCard loginCard">
        <h1>登录 MINO AGENT</h1>
        <p className="pageSub">演示环境：任意账号密码即可登录，接入后端后替换为 JWT 鉴权</p>

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

        <div className="onboardingActions">
          <button className="btn ghost" onClick={() => navigate('/onboarding')}>游客模式</button>
          <button className="btn primary" onClick={submit} disabled={!name.trim() || !password.trim()}>登录</button>
        </div>
      </div>
    </div>
  )
}
