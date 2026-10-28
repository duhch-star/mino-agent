'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require.resolve('./main.cjs'), 'utf8');
// Run the real production registration function without booting services or
// accessing any profile, credentials, or the system clipboard.
const registration = source.slice(source.indexOf('function permissions() {'), source.indexOf('function createWindow() {'));
function handlers() {
  const captured = {};
  const trusted = { id: 1, getURL: () => 'http://127.0.0.1:5175/chat' };
  const context = { session: { defaultSession: {
    setPermissionCheckHandler: fn => { captured.check = fn; },
    setPermissionRequestHandler: fn => { captured.request = fn; },
    setDevicePermissionHandler: fn => { captured.device = fn; },
  } }, trustedContents: contents => contents === trusted,
    localUrl: value => { try { return new URL(value).origin === 'http://127.0.0.1:5175'; } catch { return false; } },
    URL, Map, Set, Boolean, dialog: { showMessageBox: async () => ({ response: 0 }) } };
  vm.runInNewContext(registration + '\npermissions();', context);
  return { ...captured, trusted };
}
test('trusted local main frame can copy plain text through both Electron handlers', () => {
  const { check, request, trusted } = handlers();
  assert.equal(check(trusted, 'clipboard-sanitized-write', 'http://127.0.0.1:5175', { isMainFrame: true }), true);
  let granted;
  request(trusted, 'clipboard-sanitized-write', value => { granted = value; }, { requestingUrl: trusted.getURL(), isMainFrame: true });
  assert.equal(granted, true);
});
test('clipboard reads, external origins, subframes and other contents remain denied', () => {
  const { check, request, trusted, device } = handlers();
  for (const permission of ['clipboard-read', 'clipboard-read-write', 'notifications', 'unknown']) {
    assert.equal(check(trusted, permission, trusted.getURL(), {}), false);
    request(trusted, permission, value => assert.equal(value, false), {});
  }
  for (const [contents, origin, details] of [[{}, trusted.getURL(), {}], [trusted, 'https://evil.invalid', {}],
    [trusted, trusted.getURL(), { isMainFrame: false }], [trusted, trusted.getURL(), { embeddingOrigin: 'https://evil.invalid' }]]) {
    assert.equal(check(contents, 'clipboard-sanitized-write', origin, details), false);
  }
  for (const [contents, details] of [[{}, { requestingUrl: trusted.getURL() }], [trusted, { requestingUrl: 'https://evil.invalid' }],
    [trusted, { requestingUrl: trusted.getURL(), isMainFrame: false }], [trusted, {}]]) {
    request(contents, 'clipboard-sanitized-write', value => assert.equal(value, false), details);
  }
  assert.equal(device(), false);
});
test('media permission type/origin boundary is unchanged', () => {
  const { check, trusted } = handlers();
  assert.equal(check(trusted, 'media', trusted.getURL(), { mediaType: 'audio' }), true);
  assert.equal(check(trusted, 'media', trusted.getURL(), { mediaType: 'video' }), true);
  assert.equal(check(trusted, 'media', trusted.getURL(), { mediaType: 'unknown' }), false);
});
