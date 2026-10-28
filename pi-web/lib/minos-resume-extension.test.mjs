import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { mkdtemp, readFile, rm, mkdir, writeFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Script } from 'node:vm';
import ts from 'typescript';
import * as fs from 'node:fs/promises';

// Execute the real extension with only SDK/auth/IO boundaries stubbed. No server.
const source = readFileSync(new URL('./minos-resume-extension.ts', import.meta.url), 'utf8');
const body = ts.transpileModule(source.replace(/^import .*;\r?\n/gm, '').replace('export function', 'function'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;
async function harness(fetch, io = {}) {
  const workspace = await mkdtemp(join(tmpdir(), 'minos-resume-'));
  const tools = new Map();
  const schema = new Proxy({}, { get: () => () => ({}) });
  const create = new Script(body + ';createMinosResumeExtension').runInNewContext({
    Type: schema, defineTool: (tool) => tool, getBridgeToken: () => 'private-token', CAREER_UI_PROMPT: '',
    createMinosDocumentTool: () => ({ name: 'document_read' }),
    process: { env: { MINOS_PI_BRIDGE_SECRET: 'secret', MINOS_PI_WORKSPACE: workspace } },
    fetch, mkdir: fs.mkdir, lstat: fs.lstat, writeFile: fs.writeFile, randomUUID: () => 'unique-id', ...io,
    join, resolve: (path) => path, Buffer,
  });
  create(() => 'session').factory({ on() {}, registerTool(tool) { tools.set(tool.name, tool); } });
  return { workspace, tools, cleanup: () => rm(workspace, { recursive: true, force: true }) };
}
const saved = { resume: { name: '新姓名' }, revision: 3, previousRevision: 2, changes: [{ field: '姓名', before: '旧姓名', after: '新姓名' }] };
function mockFetch(responses, calls) {
  return async (url, options) => {
    calls.push({ url, ...JSON.parse(options.body) });
    const next = responses.shift();
    if (next instanceof Error) throw next;
    assert.ok(next, 'unexpected request');
    return next;
  };
}
const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });
const pdf = () => new Response('%PDF-test', { headers: { 'content-type': 'application/pdf' } });

for (const name of ['resume_update', 'resume_set_template']) {
  test(`${name} saves then compiles and downloads exact saved revision with authoritative changes`, async () => {
    const calls = [];
    const h = await harness(mockFetch([json(saved), json({ revision: 3, warnings: ['warning'] }), pdf()], calls));
    try {
      const result = (await h.tools.get(name).execute('id', {}, undefined)).details.result;
      assert.equal(result.saved, true);
      assert.equal(result.revision, 3);
      assert.equal(result.previousRevision, 2);
      assert.deepEqual(result.changes, saved.changes);
      assert.equal(await readFile(result.pdfPath, 'utf8'), '%PDF-test');
      assert.deepEqual(calls.map(call => call.name), [name, 'resume_compile', undefined]);
      assert.equal(calls[2].revision, 3);
      assert.match(h.tools.get(name).description, /仅要求建议.*不得调用/);
    } finally { await h.cleanup(); }
  });
}
for (const [label, responses] of [
  ['compile HTTP error', [json(saved), json({ error: { message: 'compiler unavailable' } }, 503)]],
  ['cancelled compile', [json(saved), new Error('aborted')]],
  ['newer revision compiled', [json(saved), json({ revision: 4 })]],
  ['revision changes before download', [json(saved), json({ revision: 3 }), json({}, 409)]],
]) {
  test(`saved success survives ${label}`, async () => {
    const calls = [];
    const h = await harness(mockFetch(responses, calls));
    try {
      const result = (await h.tools.get('resume_update').execute('id', {}, undefined)).details.result;
      assert.equal(result.saved, true);
      assert.equal(result.pdfPath, null);
      assert.equal(result.revision, 3);
      assert.equal(result.previousRevision, 2);
      assert.deepEqual(result.changes, saved.changes);
      assert.match(result.compileError, /已保存.*PDF/);
      if (label === 'newer revision compiled') assert.equal(calls.length, 2);
    } finally { await h.cleanup(); }
  });
}
test('exclusive collision never returns an existing file as the downloaded PDF', async () => {
  const h = await harness(mockFetch([json(saved), json({ revision: 3 }), pdf()], []));
  try {
    const folder = join(h.workspace, 'resume-previews');
    await mkdir(folder);
    const path = join(folder, 'session-r3-unique-id.pdf');
    await writeFile(path, 'do not overwrite');
    const result = (await h.tools.get('resume_update').execute('id', {}, undefined)).details.result;
    assert.equal(result.saved, true);
    assert.equal(result.pdfPath, null);
    assert.match(result.compileError, /EEXIST/);
    assert.equal(await readFile(path, 'utf8'), 'do not overwrite');
  } finally { await h.cleanup(); }
});
test('explicit compile still throws and failed save never attempts compilation', async () => {
  for (const name of ['resume_compile', 'resume_update']) {
    const calls = [];
    const h = await harness(mockFetch([json({ error: { message: 'failed' } }, 503)], calls));
    try {
      await assert.rejects(h.tools.get(name).execute('id', {}, undefined), /failed/);
      assert.equal(calls.length, 1);
      assert.deepEqual(await readdir(h.workspace), []);
    } finally { await h.cleanup(); }
  }
});
test('read is read-only and explicit compile can download successfully', async () => {
  const calls = [];
  const h = await harness(mockFetch([json(saved), json({ revision: 3 }), pdf()], calls));
  try {
    const read = (await h.tools.get('resume_read').execute('id', {}, undefined)).details.result;
    assert.equal(read.pdfPath, undefined);
    assert.equal(calls.length, 1);
    const compiled = (await h.tools.get('resume_compile').execute('id', {}, undefined)).details.result;
    assert.equal(await readFile(compiled.pdfPath, 'utf8'), '%PDF-test');
    assert.equal(compiled.saved, undefined);
  } finally { await h.cleanup(); }
});
test('linked PDF folder is rejected without disguising save success', async () => {
  const h = await harness(mockFetch([json(saved), json({ revision: 3 }), pdf()], []), {
    lstat: async () => ({ isSymbolicLink: () => true }),
    writeFile: async () => { assert.fail('must not write through linked PDF folder'); },
  });
  try {
    const result = (await h.tools.get('resume_update').execute('id', {}, undefined)).details.result;
    assert.equal(result.saved, true);
    assert.equal(result.pdfPath, null);
    assert.match(result.compileError, /link/);
  } finally { await h.cleanup(); }
});
test('explicit compile download failure still throws', async () => {
  const h = await harness(mockFetch([json({ revision: 3 }), json({}, 409)], []));
  try { await assert.rejects(h.tools.get('resume_compile').execute('id', {}, undefined), /PDF/); }
  finally { await h.cleanup(); }
});
