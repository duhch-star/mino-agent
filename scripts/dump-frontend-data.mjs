// 一次性脚本：把前端 src/data/*.js 的 mock 数据导出为 JSON，供后端 seed/接口使用。
// 运行：node scripts/dump-frontend-data.mjs
import { writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const frontData = join(here, '..', 'mino-agent', 'src', 'data')
const outDir = join(here, '..', 'backend', 'app', 'data')
mkdirSync(outDir, { recursive: true })

async function load(modPath) {
  return await import(pathToFileURL(modPath).href)
}
import { pathToFileURL } from 'node:url'

const { colleges } = await load(join(frontData, 'colleges.js'))
const { textbookGroups } = await load(join(frontData, 'textbooks.js'))
const { chapters, quizBank, chapterIndex } = await load(join(frontData, 'chapters.js'))
const { positions, difficulties, durations, questionBank } = await load(join(frontData, 'interview.js'))

writeFileSync(join(outDir, 'colleges.json'), JSON.stringify(colleges, null, 2), 'utf8')
writeFileSync(join(outDir, 'textbooks.json'), JSON.stringify(textbookGroups, null, 2), 'utf8')
writeFileSync(join(outDir, 'guides.json'), JSON.stringify({
  chapters,
  quizBank,
  chapterIndex,
}, null, 2), 'utf8')
writeFileSync(join(outDir, 'interview.json'), JSON.stringify({
  positions,
  difficulties,
  durations,
  questionBank,
}, null, 2), 'utf8')

console.log('Dumped: colleges.json, textbooks.json, guides.json, interview.json')
