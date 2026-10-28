// 章节标题 → id 索引（由后端 /api/guides 构建，供 [[内链]] 渲染使用）
// 缓存避免每次渲染重复请求；同一份数据同时供 ChapterReader/Home 等使用。
import { fetchGuides } from '../api.js'

let cache = null
let idCache = {}
let inflight = null

export async function ensureChapterIndex(force = false) {
  if (cache && !force) return cache
  if (!inflight) {
    inflight = fetchGuides()
      .then((guides) => {
        cache = Object.fromEntries((guides || []).map(c => [c.title, c.id]))
        idCache = Object.fromEntries((guides || []).map(c => [c.id, c.title]))
        return cache
      })
      .finally(() => { inflight = null })
  }
  return inflight
}

export function getChapterIndex() {
  return cache || {}
}

// id → 标题（如面试复盘"去补课"按钮）
export function getChapterTitle(id) {
  return idCache[id] || ''
}

// 本地拓扑排序（与 src/data/chapters.js learningPath 一致）
export function learningPathFrom(guides) {
  const order = []
  const remaining = [...(guides || [])]
  while (remaining.length > 0) {
    const idx = remaining.findIndex(c =>
      (c.prereq || []).every(p => !getChapterIndex()[p] || order.some(o => o.title === p)),
    )
    if (idx === -1) { order.push(...remaining); break }
    order.push(remaining[idx])
    remaining.splice(idx, 1)
  }
  return order
}