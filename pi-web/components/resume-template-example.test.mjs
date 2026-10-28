import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Script } from 'node:vm';
import ts from 'typescript';
const route = readFileSync(new URL('../app/api/minos/resume-templates/route.ts', import.meta.url), 'utf8');
const body = ts.transpileModule(route.replace(/^import .*;\r?\n/gm, '').replace('export async function', 'async function'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;
const request = query => ({ nextUrl: new URL('http://localhost/api/minos/resume-templates' + query) });
function handler(backendFetch) {
  return new Script(body + ';GET').runInNewContext({ Response, Set, NextResponse: Response, backendFetch });
}
test('catalog rewrites original PDF and licenses to fixed same-origin resources', async () => {
  const calls = [];
  const get = handler(async path => { calls.push(path); return Response.json({ items: [{ id: 'classic', originalPdfUrl: 'http://private-host/original.pdf' }, { id: 'untrusted' }] }); });
  const data = await (await get(request(''))).json();
  assert.deepEqual(calls, ['/api/resume/templates']);
  assert.equal(data.items.length, 1);
  assert.equal(data.items[0].originalPdfUrl, '/api/minos/resume-templates?template=classic&resource=original.pdf');
});
test('all five backend catalogue entries are available and adapted URLs are honest', async () => {
  const ids = ['classic','sidebar','mcdowell','hunner','minimal'];
  const get = handler(async () => Response.json({items:ids.map(id=>({id}))}));
  const data=await (await get(request(''))).json();
  assert.equal(data.items.length,5);
  for(const item of data.items) {
    assert.match(item.originalPdfUrl, /classic|sidebar/.test(item.id) ? /resource=original.pdf$/ : /resource=template.pdf$/);
    assert.equal(item.exampleKind, /classic|sidebar/.test(item.id) ? 'upstream-original' : 'synthetic-adaptation');
  }
});
test('adapted template.pdf aliases the compatible original.pdf backend route', async () => {
  const get=handler(async path=>{assert.equal(path,'/api/resume/templates/mcdowell/original.pdf');return new Response('%PDF-test');});
  const response=await get(request('?template=mcdowell&resource=template.pdf'));
  assert.equal(response.headers.get('content-type'),'application/pdf');
  assert.match(response.headers.get('content-disposition'),/synthetic-template-example/);
});
test('PDF proxy returns full upstream bytes as inline PDF', async () => {
  const bytes = new Uint8Array([37,80,68,70,45,0,255,10]);
  const get = handler(async path => { assert.equal(path, '/api/resume/templates/sidebar/original.pdf'); return new Response(bytes); });
  const response = await get(request('?template=sidebar&resource=original.pdf'));
  assert.equal(response.headers.get('content-type'), 'application/pdf');
  assert.match(response.headers.get('content-disposition'), /^inline/);
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()), bytes);
});
test('resource allowlist rejects traversal and arbitrary URL without backend access', async () => {
  const get = handler(() => { throw new Error('must not fetch'); });
  for (const query of ['?template=classic', '?template=unknown&resource=original.pdf', '?template=classic&resource=../../secret', '?template=https://evil.test&resource=original.pdf']) {
    assert.equal((await get(request(query))).status, 404);
  }
});
test('unavailable backend is explicit rather than substituted HTML sample', async () => {
  assert.equal((await handler(async () => { throw new Error('offline'); })(request(''))).status, 502);
});
test('initial welcome does not embed PDFs; optional template component only drafts instructions', () => {
  const welcome = readFileSync(new URL('./CareerWelcome.tsx', import.meta.url), 'utf8');
  const component = readFileSync(new URL('./ResumeTemplateExample.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(welcome, /ResumeTemplateExample|<iframe|<embed|<object/);
  assert.doesNotMatch(component, /<(?:iframe|object|embed)\b/);
  assert.match(component, /onChooseTask\(templateDraft\(template\)\)/);
  assert.match(component, /作者.*不会作为你的经历保存/);
  assert.doesNotMatch(component, /method:\s*['"]POST/);
});
