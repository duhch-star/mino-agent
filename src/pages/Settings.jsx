import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUiStore, useAuthStore } from '../store.js'
import { IconClose } from '../components/Icons.jsx'

const SECTIONS = [
  { id: 'general', label: '通用' },
  { id: 'account', label: '账户' },
  { id: 'appearance', label: '外观' },
  { id: 'privacy', label: '隐私与数据' },
  { id: 'about', label: '关于' },
]

function Switch({ on, onToggle }) {
  return <button className={`switch${on ? ' on' : ''}`} onClick={onToggle} role="switch" aria-checked={on} />
}

function SettingRow({ label, desc, children }) {
  return (
    <div className="settingRow">
      <div>
        <div className="settingLabel">{label}</div>
        {desc && <div className="settingDesc">{desc}</div>}
      </div>
      {children}
    </div>
  )
}

export default function Settings() {
  const dark = useUiStore(s => s.dark)
  const toggleDark = useUiStore(s => s.toggleDark)
  const fontSize = useUiStore(s => s.fontSize)
  const setFontSize = useUiStore(s => s.setFontSize)
  const closeSettings = useUiStore(s => s.closeSettings)
  const user = useAuthStore(s => s.user)
  const logout = useAuthStore(s => s.logout)
  const navigate = useNavigate()

  const [section, setSection] = useState('general')
  const [enterToSend, setEnterToSend] = useState(true)
  const [deleted, setDeleted] = useState(false)

  return (
    <div className="settingsOverlay">
      <div className="settingsMask" onClick={closeSettings} />
      <div className="settingsPanel">
        <nav className="settingsNav">
          <div className="settingsNavTitle">设置</div>
          <div className="settingsNavList">
            {SECTIONS.map(s => (
              <button
                key={s.id}
                className={`settingsNavCell${section === s.id ? ' active' : ''}`}
                onClick={() => setSection(s.id)}
              >
                <span className="navLabel" style={{ flex: 1 }}>{s.label}</span>
              </button>
            ))}
          </div>
        </nav>

        <div className="settingsContent">
          <div className="settingsHeader">
            <span className="settingsHeaderTitle">{SECTIONS.find(s => s.id === section)?.label}</span>
            <button className="settingsClose" onClick={closeSettings} aria-label="关闭设置">
              <IconClose size={16} />
            </button>
          </div>

          <div className="settingsOptions">
            {section === 'general' && (
              <>
                <div className="sectionLabel">对话</div>
                <SettingRow label="回车发送" desc="按 Enter 发送消息，Shift+Enter 换行">
                  <Switch on={enterToSend} onToggle={() => setEnterToSend(v => !v)} />
                </SettingRow>
                <div className="sectionLabel">用量</div>
                <SettingRow label="今日问答额度" desc="剩余额度透明展示（演示数据）">
                  <span className="settingDesc">12 / 50 次</span>
                </SettingRow>
              </>
            )}

            {section === 'account' && (
              <>
                <div className="sectionLabel">账号</div>
                {user ? (
                  <>
                    <SettingRow label="昵称" desc={user.role === 'admin' ? '管理员账号' : '求职者账号'}>
                      <span className="settingDesc">{user.name}</span>
                    </SettingRow>
                    <SettingRow label="账号类型">
                      <span className="settingDesc">{user.role === 'admin' ? '管理员' : '求职者'}</span>
                    </SettingRow>
                    <SettingRow label="退出登录" desc="退出后回到游客模式，本地数据保留">
                      <button className="btn outline sm" onClick={logout}>退出登录</button>
                    </SettingRow>
                  </>
                ) : (
                  <SettingRow label="未登录" desc="登录后可同步数据，或使用管理员内容审核">
                    <button className="btn primary sm" onClick={() => navigate('/login')}>登录</button>
                  </SettingRow>
                )}
              </>
            )}

            {section === 'appearance' && (
              <>
                <div className="sectionLabel">主题</div>
                <SettingRow label="深色主题" desc="切换设计令牌的明暗配色">
                  <Switch on={dark} onToggle={toggleDark} />
                </SettingRow>
                <div className="sectionLabel">文字</div>
                <SettingRow label="内容字号" desc={`当前 ${fontSize}px（作用于消息与正文）`}>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {[13, 14, 16].map(n => (
                      <button
                        key={n}
                        className="modelHint"
                        style={{
                          background: fontSize === n ? 'var(--dsw-alias-interactive-bg-hover)' : 'transparent',
                          color: fontSize === n ? 'var(--dsw-alias-label-primary)' : 'var(--dsw-alias-label-secondary)',
                        }}
                        onClick={() => setFontSize(n)}
                      >
                        {n}px
                      </button>
                    ))}
                  </div>
                </SettingRow>
              </>
            )}

            {section === 'privacy' && (
              <>
                <div className="sectionLabel">隐私</div>
                <SettingRow label="麦克风与录音" desc="仅在你明确授权后采集；面试结束可选择是否保存转写/录音">
                  <span className="settingDesc">默认关闭</span>
                </SettingRow>
                <SettingRow label="摄像头" desc="仅在视频面试时、经你授权后开启；语音/文字面试不采集">
                  <span className="settingDesc">按需授权</span>
                </SettingRow>
                <SettingRow label="清除本地数据" desc="删除学习进度、对话与面试记录">
                  <button
                    className="btn outline sm"
                    onClick={() => setDeleted(true)}
                  >
                    {deleted ? '已清除' : '清除数据'}
                  </button>
                </SettingRow>
              </>
            )}

            {section === 'about' && (
              <>
                <div className="sectionLabel">关于</div>
                <SettingRow label="MINO AGENT" desc="面向求职者的学习、模拟面试与职业辅导智能体">
                  <span className="settingDesc">v0.1.0</span>
                </SettingRow>
                <SettingRow label="设计系统" desc="设计令牌拷贝自 deepseek-harness packages/client/ui-theme">
                  <span className="settingDesc">ui-theme</span>
                </SettingRow>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
