import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLearningStore } from '../store.js'
import { Brand } from '../components/Brand.jsx'

const DIRECTIONS = ['产品', '开发', '数据', '设计', '运营', '其他']
const LEVELS = ['在校生', '应届', '1-3 年', '3 年以上']

export default function Onboarding() {
  const navigate = useNavigate()
  const setProfile = useLearningStore(s => s.setProfile)
  const [direction, setDirection] = useState('')
  const [level, setLevel] = useState('')

  const finish = () => {
    setProfile({ direction: direction || '未设置', level: level || '未设置' })
    navigate('/home')
  }
  const skip = () => {
    setProfile({ direction: '未设置', level: '未设置' })
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
