import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
const source = readFileSync(new URL('./ResumeRevisionCard.tsx', import.meta.url), 'utf8').replace('import "./resume-revision.css";', '');
const compiled = ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS } }).outputText;
const mod = { exports: {} };
new Function('require', 'module', 'exports', compiled)(createRequire(import.meta.url), mod, mod.exports);
const { ResumeRevisionCard } = mod.exports;
const render = (result) => renderToStaticMarkup(React.createElement(ResumeRevisionCard, { result: { toolCallId: 'x', revision: 2, warnings: [], ...result }, onOpenFile() {}, onRetry() {} }));
test('renders actual before/after, revision and PDF reopening control', () => {
  const html = render({ previousRevision: 1, changes: [{ field: '简介', before: '原始内容', after: '优化内容' }], pdfPath: 'E:/preview.pdf' });
  for (const text of ['修改前后对比', '修改前', '修改后', '原始内容', '优化内容', 'v1 → v2', '查看简历 PDF']) assert.ok(html.includes(text));
});
test('escapes user content and identifies added and deleted text', () => {
  const html = render({ changes: [{ field: '<script>', before: '', after: '<img src=x onerror=alert(1)>' }, { field: '删除', before: '旧内容', after: '' }] });
  assert.ok(!html.includes('<script>'));
  assert.ok(!html.includes('<img'));
  assert.ok(html.includes('原内容为空'));
  assert.ok(html.includes('已移除内容'));
});
test('saved-but-failed compilation preserves comparison and offers retry', () => {
  const html = render({ changes: [], compileError: '超时', warnings: ['文本溢出'] });
  for (const text of ['未改变简历内容', '简历已保存', '超时', '重试编译', '排版提醒', '文本溢出']) assert.ok(html.includes(text));
  assert.ok(!html.includes('查看简历 PDF'));
});
test('standalone compile does not claim a document save', () => {
  const html = render({ pdfPath: '/workspace/resume.pdf' });
  assert.ok(html.includes('PDF 已编译'));
  assert.ok(!html.includes('真实修改记录'));
});
test('revision cards remain outside collapsed process details', () => {
  const chat = readFileSync(new URL('./ChatWindow.tsx', import.meta.url), 'utf8');
  assert.ok(chat.indexOf('<ResumeRevisionCard') > chat.indexOf('</ProcessDetailsGroup>'));
  assert.ok(chat.includes('consumeResumePreviews(messages.slice(0, start), state.seen)'));
});
