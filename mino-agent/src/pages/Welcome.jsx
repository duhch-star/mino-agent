import { Link, useNavigate } from 'react-router-dom'
import { Brand } from '../components/Brand.jsx'
import { useUiStore } from '../store.js'
import { IconBook, IconMic, IconBriefcase } from '../components/Icons.jsx'

const FEATURES = [
  { icon: IconBook, title: '知识库', desc: '系统学习求职章节，补齐短板' },
  { icon: IconMic, title: 'AI 面试', desc: 'MINO AGENT 当面试官，逐题反馈' },
  { icon: IconBriefcase, title: '职业辅导', desc: '简历优化 · 岗位匹配' },
]

export default function Welcome() {
  const navigate = useNavigate()
  const openSettings = useUiStore(s => s.openSettings)

  return (
    <div className="welcome">
      {/* 品牌标记 */}
      <Brand size={40} />

      {/* 标语 + 问候 */}
      <div className="welcomeHero">
        <p className="welcomeTagline">你的求职教练，陪你 <em>学习 · 模拟面试 · 复盘</em></p>
        <p className="welcomeGreeting">嗨，我是 MINO AGENT 👋 从知识到面试，我陪你一起准备。</p>
      </div>

      {/* 核心能力 */}
      <div className="featureRow">
        {FEATURES.map(f => {
          const I = f.icon
          return (
            <div key={f.title} className="featureCard">
              <span className="featureIcon"><I size={20} /></span>
              <div className="featureTitle">{f.title}</div>
              <div className="featureDesc">{f.desc}</div>
            </div>
          )
        })}
      </div>

      {/* 行动按钮 */}
      <div className="welcomeActions">
        <button className="welcomePrimary" onClick={() => navigate('/onboarding')}>开始使用</button>
        <button className="welcomeSecondary" onClick={() => navigate('/login')}>登录</button>
        <button className="welcomeSecondary" onClick={openSettings}>设置</button>
      </div>

      {/* 声明 + 隐私要点 */}
      <div className="welcomeFoot">
        <div className="welcomePrivacy">
          <span>MINO AGENT 提供学习与训练建议，不构成录用保证或人格判断</span>
          <span>麦克风仅在授权后开启 · 录音可随时删除 · 摄像头仅在视频面试时授权开启</span>
        </div>
        <div className="welcomeLinks">
          <Link to="#" className="footerLink">隐私政策</Link>
          <span className="footerDot">·</span>
          <Link to="#" className="footerLink">使用条款</Link>
        </div>
      </div>
    </div>
  )
}
