// ---------------------------------------------------------------------------
// ThinkingIndicator：替代「闪烁点」的蛇形走位细线循环动画
//  - SVG ∞字轨道（静态细线）+ 光点沿轨道蛇形循环（SMIL animateMotion）
//  - 双光点错相流动，视觉如光蛇走位，无回跳、无闪烁
//  - 可展示当前激活的工具 / skill（可扩展：label 由调用方传入）
// ---------------------------------------------------------------------------

// 蛇形轨道：横 8 字（∞）闭合路径，光点可无限平滑循环
const SNAKE_PATH = 'M 32 16 C 32 5.5 49 5.5 49 16 C 49 26.5 32 26.5 32 16 C 32 5.5 15 5.5 15 16 C 15 26.5 32 26.5 32 16 Z'

function SnakeDot({ dur = '1.6s', begin = '0s', r = 2.6, className = 'thinkingHead' }) {
  return (
    <circle r={r} className={className}>
      <animateMotion dur={dur} begin={begin} repeatCount="indefinite" path={SNAKE_PATH} />
    </circle>
  )
}

export default function ThinkingIndicator({ label = '正在思考…', tool = null, skill = null }) {
  return (
    <div className="thinking" role="status" aria-live="polite">
      <svg className="thinkingSnake" viewBox="0 0 64 32" width="60" height="30" aria-hidden="true">
        {/* 细线轨道 */}
        <path d={SNAKE_PATH} className="thinkingTrack" />
        {/* 流动光蛇：两条错相的光点 + 尾迹 */}
        <path d={SNAKE_PATH} className="thinkingTrail" />
        <SnakeDot dur="1.7s" begin="0s" r={2.8} className="thinkingHead" />
        <SnakeDot dur="1.7s" begin="-0.85s" r={2.2} className="thinkingHeadGhost" />
      </svg>
      <span className="thinkingText">{label}</span>
      {tool && <span className="thinkingBadge">工具 · {tool}</span>}
      {skill && <span className="thinkingBadge thinkingBadgeSkill">技能 · {skill}</span>}
    </div>
  )
}