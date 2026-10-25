import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLearningStore, useAuthStore } from '../store.js'
import { saveUserProfile } from '../api.js'
import { Brand } from '../components/Brand.jsx'

const DIRECTIONS = ['产品', '开发', '数据', '设计', '运营', '其他']
const LEVELS = ['在校生', '应届', '1-3 年', '3 年以上']

export default function Onboarding() {
  const navigate = useNavigate()
  const setProfile = useLearningStore(s => s.setProfile)
  const user = useAuthStore(s => s.user)
  const [direction, setDirection] = useState('')
  const [level, setLevel] = useState('')

  const persist = async (dir, lv) => {
    setProfile({ direction: dir || '未设置', level: lv || '未设置' })
    if (user) {
      saveUserProfile({ direction: dir || '', level: lv || '', targetRoles: [] }).catch(() => {})
    }
  }

  const finish = async () => {
    await persist(direction, level)
    navigate('/home')
  }
  const skip = async () => {
    await persist('', '')
    navigate('/home')
  }

  return (
    <div className="onboarding">
      <div className="onboardingBrand">
        <Brand size={40} />
      </div>

      <div className="onboardingCard">
        <h1>先认识一下你</h1>
        <p className="pageSub">这能让我给你更对口的推荐与面试题（可跳过）</p>

        <div className="onboardingField">
          <div className="sectionTitle">求职方向</div>
          <div className="chipRow">
            {DIRECTIONS.map(d => (
              <button key={d} className={`chip${direction === d ? ' on' : ''}`} onClick={() => setDirection(d)}>{d}</button>
            ))}
          </div>
        </div>

        <div className="onboardingField">
          <div className="sectionTitle">经验</div>
          <div className="chipRow">
            {LEVELS.map(l => (
              <button key={l} className={`chip${level === l ? ' on' : ''}`} onClick={() => setLevel(l)}>{l}</button>
            ))}
          </div>
        </div>

        <div className="onboardingActions">
          <button className="btn ghost" onClick={skip}>跳过</button>
          <button className="btn primary" onClick={finish}>开始</button>
        </div>
      </div>
    </div>
  )
}