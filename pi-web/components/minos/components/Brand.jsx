import { XiaominMark } from './XiaominMark.jsx'

// MINO AGENT 品牌字标：双色（MINO 主色粗体 + AGENT 次级灰）+ 等宽字距 + 副标题
export function Brand({ size = 24 }) {
  const large = size >= 30
  return (
    <span className="brandLockup">
      <span className="brandLockupMark"><XiaominMark size={size} /></span>
      <span className="brandLockupText">
        <span className="brandWordmark" style={{ fontSize: large ? 26 : 17 }}>
          <span className="wm-mino">MINO</span> <span className="wm-agent">AGENT</span>
        </span>
        <span className="brandSubtitle" style={{ fontSize: large ? 12 : 10 }}>
          Job-seeking Agent
        </span>
      </span>
    </span>
  )
}
