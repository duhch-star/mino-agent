import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJiti } from 'jiti';
const root = await mkdtemp(join(tmpdir(), 'pi-interview-test-'));
const previous = process.env.PI_CODING_AGENT_DIR;
process.env.PI_CODING_AGENT_DIR = root;
process.env.PI_OFFLINE = '1';
await mkdir(root, { recursive: true });
await writeFile(join(root, 'models.json'), JSON.stringify({ providers: { acme: { api: 'openai-completions', apiKey: 'FAKE-SECRET-TEST-ONLY', baseUrl: 'https://example.invalid/v1', models: [{ id: 'one', name: 'One' }] } } }));
await writeFile(join(root, 'settings.json'), JSON.stringify({ defaultProvider: 'acme', defaultModel: 'one', enabledModels: ['acme/*'] }));
const jiti = createJiti(import.meta.url, { alias: { '@': process.cwd() } });
const { GET } = await jiti.import('./models/route.ts');
const { POST } = await jiti.import('./feedback/stream/route.ts');
const { getModelRuntimeWithExtensions } = await jiti.import('../../../lib/model-runtime.ts');
after(async () => { if (previous === undefined) delete process.env.PI_CODING_AGENT_DIR; else process.env.PI_CODING_AGENT_DIR = previous; await rm(root, { recursive: true, force: true }); });
test('catalog returns only safe identities and account default', async () => {
  const response = await GET(new Request('http://localhost/api/interview/models'));
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.deepEqual(body.defaultModel, { provider: 'acme', modelId: 'one' });
  assert.equal(body.models[0].supported, true);
  assert.equal(JSON.stringify(body).includes('FAKE-SECRET'), false);
  assert.equal(JSON.stringify(body).includes('example.invalid'), false);
});
test('feedback uses server SDK and validates stream without exposing upstream secrets', async () => {
  const runtime = await getModelRuntimeWithExtensions();
  const original = runtime.streamSimple;
  const valid = { reply: '这是基于材料的反馈', score: 4, dimensions: Array.from({ length: 3 }, () => ({ name: '结构', stars: 4, note: '依据' })), strengths: ['行动'], suggestions: ['补充结果'], starExample: '待补充' };
  runtime.streamSimple = async function* (model) { assert.equal(model.provider, 'acme'); yield { type: 'text_delta', delta: JSON.stringify(valid) }; yield { type: 'done', reason: 'stop' }; };
  const request = body => new Request('http://localhost/api/interview/feedback/stream', { method: 'POST', body: JSON.stringify(body) });
  try {
    const response = await POST(request({ answer: '真实回答' }));
    const events = (await response.text()).trim().split('\n').map(JSON.parse);
    assert.deepEqual(events.map(e => e.type), ['preview', 'complete']);
    assert.equal(events[1].feedback.score, 4);
    runtime.streamSimple = async function* () { throw new Error('FAKE-SECRET-TEST-ONLY upstream headers'); };
    const failed = await POST(request({ answer: '真实回答' }));
    const text = await failed.text();
    assert.match(text, /feedback_upstream/);
    assert.equal(text.includes('FAKE-SECRET'), false);
    assert.equal((await POST(request({ answer: '回答', model: { provider: 'missing', modelId: 'x' } }))).status, 409);
    assert.equal((await POST(request({ answer: '' }))).status, 400);
  } finally { runtime.streamSimple = original; }
});
