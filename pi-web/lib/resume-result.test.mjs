import assert from 'node:assert/strict';
import test from 'node:test';
import { createJiti } from 'jiti';
const jiti = createJiti(import.meta.url, { tsconfigPaths: true });
const { getResumeResult, consumeResumePreviews } = await jiti.import('./resume-result.ts');
const result = (id, value = {}, extra = {}) => ({ role: 'toolResult', toolCallId: id, details: { kind: 'minos-resume', result: { revision: 2, ...value } }, content: [], ...extra });
test('only bridge tool results can produce saved revision cards', () => {
  assert.equal(getResumeResult({ role: 'assistant', content: [] }), null);
  assert.equal(getResumeResult(result('x', { changes: [] }, { isError: true })), null);
  assert.equal(getResumeResult(result('x', {}, { details: { kind: 'other', result: { revision: 2, changes: [] } } })), null);
  assert.equal(getResumeResult(result('x')), null); // resume_read
});
test('keeps exact complete server differences and revision identity', () => {
  const changes = [{ field: '项目经历', before: '原文\n第二行', after: '修改后' }];
  assert.deepEqual(getResumeResult(result('x', { previousRevision: 1, changes })).changes, changes);
  assert.equal(getResumeResult(result('x', { previousRevision: 1, changes })).previousRevision, 1);
});
test('empty change set is still a real save; compile failures preserve it', () => {
  const value = getResumeResult(result('x', { changes: [], compileError: '超时' }));
  assert.deepEqual(value.changes, []);
  assert.equal(value.compileError, '超时');
  assert.equal(value.pdfPath, undefined);
});
test('rejects invalid paths and revisions; filters malformed changes and warnings', () => {
  for (const path of ['javascript:alert(1).pdf', 'https://example.org/a.pdf', '../a.pdf']) assert.equal(getResumeResult(result('x', { changes: [], pdfPath: path })).pdfPath, undefined);
  assert.equal(getResumeResult(result('x', { revision: -1, changes: [] })), null);
  assert.deepEqual(getResumeResult(result('x', { changes: [null, {}, { field: 'x', before: '', after: 'a' }], warnings: [1, '过长'] })).warnings, ['过长']);
});
test('baselines old results and opens only latest new PDF once despite replay', () => {
  const seen = new Set();
  const a = result('a', { pdfPath: 'E:/resume-previews/a-r1.pdf' });
  const b = result('b', { pdfPath: 'E:/resume-previews/a-r2.pdf' });
  const c = result('c', { pdfPath: '/workspace/resume-previews/a-r3.pdf' });
  consumeResumePreviews([a], seen); // history baseline ignored by caller
  assert.equal(consumeResumePreviews([a, b, c], seen), '/workspace/resume-previews/a-r3.pdf');
  assert.equal(consumeResumePreviews([a, b, c], seen), undefined);
});
