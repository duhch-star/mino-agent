import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { hasResumeContent, originalPdfUrl } from './resume-preview.js'

const source = path => readFileSync(new URL(path, import.meta.url), 'utf8')

test('empty content and section scaffolding display original sample without importing author data', () => {
  assert.equal(hasResumeContent(null), false)
  assert.equal(hasResumeContent({ name: '', contact: '', summary: '', sections: [{ title: '教育经历', items: [], entries: [], column: 'left' }] }), false)
  for (const resume of [{ name: '本人' }, { contact: 'me@example.com' }, { summary: '介绍' }, { sections: [{ items: ['技能'] }] }, { sections: [{ entries: [{ heading: '学校' }] }] }, { sections: [{ entries: [{ items: ['成果'] }] }] }]) assert.equal(hasResumeContent(resume), true)
})

test('original PDF accepts HTTP(S) only and handles missing metadata', () => {
  assert.equal(originalPdfUrl({ originalPdfUrl: 'https://example.com/sample.pdf' }), 'https://example.com/sample.pdf')
  for (const url of ['javascript:alert(1)', 'data:application/pdf;base64,AA', 'file:///sample.pdf', undefined]) assert.equal(originalPdfUrl({ originalPdfUrl: url }), '')
})

test('default preview uses original PDF, compiled PDF retains priority and version guards', () => {
  const panel = source('./ResumePanel.jsx')
  const studio = source('../pages/ResumeStudio.jsx')
  const gallery = source('./ResumeTemplateGallery.jsx')
  assert.match(panel, /\[tab, setTab\] = useState\('preview'\)/)
  assert.match(panel, /pdf\.revision === document\?\.revision && pdf\.template === document\?\.template/)
  assert.match(panel, /showOriginal \? <ResumeOriginalPdf template=\{selectedTemplate\}/)
  assert.match(panel, /documentRef\.current\?\.revision !== result\.revision/)
  assert.match(panel, /expectedRevision/)
  assert.match(panel, /draftConflict/)
  assert.match(studio, /pdf \? <iframe[^]*?showOriginal \? <ResumeOriginalPdf/)
  assert.match(studio, /serialize\(resume\) !== proposal\.base/)
  assert.match(gallery, /originalPdfUrl\(preview\) \? <ResumeOriginalPdf/)
  assert.match(source('./ResumeOriginalPdf.jsx'), /不会导入、保存或作为你的履历/)
})
