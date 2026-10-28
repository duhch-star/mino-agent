import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Script } from 'node:vm';
import ts from 'typescript';
import { createJiti } from 'jiti';
const source = readFileSync(new URL('./minos-document-tool.ts', import.meta.url), 'utf8');
const body = ts.transpileModule(source.replace(/^import .*;\r?\n/gm, '').replace('export function', 'function'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
function tool(fetch, token = 'synthetic-token') {
  return new Script(body + ';createMinosDocumentTool("http://127.0.0.1:8005")').runInNewContext({
    Type: new Proxy({}, { get: () => () => ({}) }), defineTool: value => value,
    getBridgeToken: () => token, process: { env: { MINOS_PI_BRIDGE_SECRET: 'synthetic-secret' } }, fetch,
  });
}
test('model-visible parsing tool calls authenticated bridge and returns extracted text', async () => {
  const controller = new AbortController(); let calls = 0;
  const reader = tool(async (url, options) => {
    calls++; assert.equal(url, 'http://127.0.0.1:8005/api/pi-web/document-read');
    assert.deepEqual(JSON.parse(options.body), { bridgeSecret: 'synthetic-secret', token: 'synthetic-token', path: '简历.docx' });
    assert.equal(options.signal, controller.signal);
    return new Response(JSON.stringify({ name: '简历.docx', text: '真实提取文本', truncated: true }));
  });
  assert.equal(reader.name, 'document_read'); assert.equal(reader.exposure, 'model-only');
  const result = await reader.execute('id', { path: '简历.docx' }, controller.signal);
  assert.match(result.content[0].text, /真实提取文本/); assert.match(result.content[0].text, /截断/); assert.equal(calls, 1);
});
test('authentication absence and empty/scan parser errors never become made-up content', async () => {
  await assert.rejects(tool(() => assert.fail('no fetch'), null).execute('id', { path: 'x.pdf' }), /重新连接/);
  const reader = tool(async () => new Response(JSON.stringify({ error: { message: '未提取到文档文字' } }), { status: 422 }));
  await assert.rejects(reader.execute('id', { path: 'x.pdf' }), /未提取到文档文字/);
});
test('actual SDK defineTool preserves the provider-visible input schema', async () => {
  // Registration requires no credentials or auth-file access; execute is not called.
  const { createMinosDocumentTool } = await createJiti(import.meta.url, { tsconfigPaths: true }).import('./minos-document-tool.ts');
  const actual = createMinosDocumentTool('http://127.0.0.1:8005');
  assert.equal(actual.name, 'document_read');
  assert.equal(actual.exposure, 'model-only');
  assert.equal(actual.parameters.type, 'object');
  assert.equal(actual.parameters.properties.path.type, 'string');
  assert.deepEqual(actual.parameters.required, ['path']);
});

test('real MINOS extension registers the parser with bridge-enabled tools', () => {
  const extension = readFileSync(new URL('./minos-resume-extension.ts', import.meta.url), 'utf8');
  assert.match(extension, /pi\.registerTool\(createMinosDocumentTool\(base\)\)/);
});
