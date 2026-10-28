import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { Script } from 'node:vm';
import ts from 'typescript';
const source = readFileSync(new URL('./MinosAccountPanel.tsx', import.meta.url), 'utf8');
const ast = ts.createSourceFile('MinosAccountPanel.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
function helper(name, globals = {}) {
  const declaration = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === name);
  return new Script(ts.transpileModule(declaration.getText(ast).replace('export ', ''), { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText + `;${name}`).runInNewContext(globals);
}
test('roles reflect the authenticated server value without assuming every account is an admin', () => {
  const role = helper('accountRoleLabel');
  assert.equal(role('admin'), '管理员');
  assert.match(role('candidate'), /candidate/);
  assert.equal(role('auditor'), 'auditor');
  assert.equal(role(''), '未提供角色');
});
test('missing or invalid usage is not rendered as a fabricated zero', () => {
  const format = helper('usageNumber');
  for (const value of [undefined, null, NaN, Infinity, -1, '10']) assert.equal(format(value), '未提供');
  assert.equal(format(0), '0');
  assert.equal(format(1000), '1,000');
});
test('deletion refuses missing confirmation and only calls the same-origin business helper', async () => {
  const requests = [];
  const clear = helper('clearBusinessData', { CLEAR_CONFIRMATION: '清除业务数据', requestApi: async (...args) => { requests.push(args); return { json: async () => ({ deleted: true }) }; } });
  for (const value of ['', '确认', '清除业务数据 ']) await assert.rejects(clear(value), /确认文字/);
  assert.equal(requests.length, 0);
  await clear('清除业务数据');
  assert.equal(requests[0][0], '/api/users/me/data');
  assert.equal(requests[0][1].method, 'DELETE');
});
test('deletion requires a confirmed server result and propagates failures', async () => {
  const badResult = helper('clearBusinessData', { CLEAR_CONFIRMATION: '清除业务数据', requestApi: async () => ({ json: async () => ({}) }) });
  await assert.rejects(badResult('清除业务数据'), /未确认删除/);
  const failed = helper('clearBusinessData', { CLEAR_CONFIRMATION: '清除业务数据', requestApi: async () => { throw Error('服务不可用'); } });
  await assert.rejects(failed('清除业务数据'), /服务不可用/);
});
test('account UI declares the precise deletion boundary and accessible guarded confirmation', () => {
  for (const text of ['账号及求职画像', '业务额度记录', 'Pi 会话 JSONL', '工作区文件', '已生成 PDF', '磁盘附件文件', '模型设置/密钥', '其他 MINOS 标签页']) assert.ok(source.includes(text), text);
  assert.match(source, /confirmation !== CLEAR_CONFIRMATION/);
  assert.match(source, /if \(deleting.current/);
  assert.match(source, /await activateAccount\(null\)/);
  assert.match(source, /window.location.reload\(\)/);
  assert.match(source, /aria-labelledby="minos-account-title"/);
  assert.match(source, /aria-describedby="minos-clear-scope"/);
  assert.doesNotMatch(source, /localStorage|accessToken|refreshToken|Authorization|127\.0\.0\.1/);
  const workspace = readFileSync(new URL('./MinosWorkspace.tsx', import.meta.url), 'utf8');
  assert.match(workspace, /<MinosAccountPanel user=\{user\}/);
  assert.match(workspace, /setAccountPanel\(true\)/);
});
