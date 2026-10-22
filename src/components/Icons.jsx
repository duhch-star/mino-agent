// 轻量内联图标（stroke 风格，currentColor），复刻 ui-primitives 的图标语义
const base = {
  width: 16,
  height: 16,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
}

export function IconNewChat({ size = 16 }) {
  return <svg {...base} width={size} height={size} aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
}

export function IconPanel({ size = 16 }) {
  return <svg {...base} width={size} height={size} aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2" /><line x1="9" y1="4" x2="9" y2="20" /></svg>
}

export function IconSettings({ size = 16 }) {
  return <svg {...base} width={size} height={size} aria-hidden="true"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
}

export function IconSend({ size = 16 }) {
  return <svg {...base} width={size} height={size} aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7" /></svg>
}

export function IconClose({ size = 16 }) {
  return <svg {...base} width={size} height={size} aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
}

export function IconChevronDown({ size = 16 }) {
  return <svg {...base} width={size} height={size} aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
}

export function IconCopy({ size = 14 }) {
  return <svg {...base} width={size} height={size} aria-hidden="true"><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
}

export function IconChat({ size = 16 }) {
  return <svg {...base} width={size} height={size} aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
}

export function IconCheck({ size = 16 }) {
  return <svg {...base} width={size} height={size} aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
}

// —— 新增：求职智能体用 ——
export function IconHome({ size = 16 }) {
  return <svg {...base} width={size} height={size} aria-hidden="true"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><path d="M9 22V12h6v10" /></svg>
}

export function IconBook({ size = 16 }) {
  return <svg {...base} width={size} height={size} aria-hidden="true"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></svg>
}

export function IconMic({ size = 16 }) {
  return <svg {...base} width={size} height={size} aria-hidden="true"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v3" /></svg>
}

export function IconBriefcase({ size = 16 }) {
  return <svg {...base} width={size} height={size} aria-hidden="true"><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" /></svg>
}

export function IconPause({ size = 16 }) {
  return <svg {...base} width={size} height={size} aria-hidden="true"><rect x="14" y="4" width="4" height="16" rx="1" /><rect x="6" y="4" width="4" height="16" rx="1" /></svg>
}

export function IconStop({ size = 16 }) {
  return <svg {...base} width={size} height={size} aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
}

export function IconBookmark({ size = 16 }) {
  return <svg {...base} width={size} height={size} aria-hidden="true"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" /></svg>
}

export function IconArrowLeft({ size = 16 }) {
  return <svg {...base} width={size} height={size} aria-hidden="true"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
}

export function IconRefresh({ size = 16 }) {
  return <svg {...base} width={size} height={size} aria-hidden="true"><path d="M21 12a9 9 0 1 1-3-6.7L21 8" /><path d="M21 3v5h-5" /></svg>
}

export function IconVideo({ size = 16 }) {
  return <svg {...base} width={size} height={size} aria-hidden="true"><path d="m22 8-6 4 6 4V8Z" /><rect x="2" y="6" width="14" height="12" rx="2" /></svg>
}

export function IconShield({ size = 16 }) {
  return <svg {...base} width={size} height={size} aria-hidden="true"><path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z" /><path d="m9 12 2 2 4-4" /></svg>
}
