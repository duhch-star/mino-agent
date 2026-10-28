import assert from 'node:assert/strict';
import test from 'node:test';
import { createJiti } from 'jiti';
const { copyText } = await createJiti(import.meta.url).import('./clipboard.ts');

function setup(writeText, result = true) {
  const calls = [];
  class Element { focus(options) { calls.push(['focus', options]); } }
  const active = new Element();
  const range = { cloneRange() { return this; } };
  const selection = { rangeCount: 1, getRangeAt: () => range, removeAllRanges() { calls.push('clear'); }, addRange(value) { assert.equal(value, range); calls.push('restore'); } };
  const textarea = { style: {}, select() { calls.push('select'); }, remove() { calls.push('remove'); } };
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { clipboard: writeText ? { writeText } : undefined } });
  globalThis.HTMLElement = Element;
  globalThis.document = { activeElement: active, getSelection: () => selection, createElement: () => textarea,
    body: { appendChild() { calls.push('append'); } }, execCommand(command) { assert.equal(command, 'copy'); calls.push('copy'); if (result instanceof Error) throw result; return result; } };
  return { calls, textarea };
}

test('native clipboard writes exactly the requested Unicode plain text', async () => {
  let copied;
  const { calls } = setup(async value => { copied = value; });
  await copyText('中文\ncode <tag>');
  assert.equal(copied, '中文\ncode <tag>');
  assert.deepEqual(calls, []);
});
for (const mode of ['missing', 'rejected', 'throws']) test(`${mode} clipboard API falls back and restores focus/selection`, async () => {
  const write = mode === 'missing' ? undefined : mode === 'throws' ? () => { throw Error('denied'); } : async () => { throw Error('denied'); };
  const { calls, textarea } = setup(write);
  await copyText('fallback');
  assert.equal(textarea.value, 'fallback');
  assert.deepEqual(calls, ['append', 'select', 'copy', 'remove', ['focus', { preventScroll: true }], 'clear', 'restore']);
});
for (const failure of [false, new Error('copy failed')]) test(`fallback ${String(failure)} rejects instead of displaying copied`, async () => {
  const { calls } = setup(undefined, failure);
  await assert.rejects(copyText('text'));
  assert.ok(calls.includes('remove'));
  assert.ok(calls.includes('restore'));
});
