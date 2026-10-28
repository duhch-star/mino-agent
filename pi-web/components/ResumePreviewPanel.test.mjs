import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const panel = readFileSync(new URL('./ResumePreviewPanel.tsx', import.meta.url), 'utf8');
const shell = readFileSync(new URL('./AppShell.tsx', import.meta.url), 'utf8');
const example = readFileSync(new URL('./ResumeTemplateExample.tsx', import.meta.url), 'utf8');
test('resume entry auto-opens a dedicated panel, even on repeat navigation', () => {
  assert.match(shell, /if \(business\.path !== '\/resume'\) return;/);
  assert.match(shell, /if \(path === '\/resume'\).*setRightPanelOpen\(true\)/);
  assert.match(shell, /<ResumePreviewPanel[^\n]*sessionId=\{selectedSession\?\.id\}/);
});
test('preview is read-only, account-scoped and cancels stale session requests', () => {
  assert.match(panel, /\/api\/business\/resume\/documents\/current/);
  assert.match(panel, /encodeURIComponent\(sessionId\)/);
  assert.match(panel, /controller\.abort\(\)/);
  assert.doesNotMatch(panel, /method:\s*['"](?:POST|PUT|PATCH)/);
  assert.doesNotMatch(panel, /resume_update|resume_set_template/);
});
test('native PDF plugins are never used by resume previews', () => {
  for (const source of [panel, example]) assert.doesNotMatch(source, /<(?:iframe|embed|object)\b/);
  assert.match(panel, /\/preview\?revision=/);
  assert.match(panel, /下载完整 PDF/);
  assert.match(panel, /pdfReady && state\.conversationId/);
  assert.match(panel, /不会创建简历或保存作者/);
  assert.match(example, /\/examples\//);
});
