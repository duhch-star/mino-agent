'use strict';

// Packaged layout: resources/payload/{runtime,backend,pi-web}. No npm, shell
// command interpolation, renderer Node integration, or inherited provider keys.
const { app, BrowserWindow, Menu, dialog, shell, session, ipcMain, screen } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const net = require('node:net');
const http = require('node:http');
const { spawn } = require('node:child_process');

const smoke = process.argv.includes('--smoke-test');
let data = path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'MINOS');
let argumentError;
for (let i = 1; i < process.argv.length; i++) {
  if (process.argv[i] === '--data-dir') {
    const value = process.argv[++i];
    if (!value || value.startsWith('--')) argumentError = new Error('--data-dir 需要目录参数。');
    else data = path.resolve(value);
  } else if (process.argv[i].startsWith('--data-dir=')) {
    const value = process.argv[i].slice(11);
    if (!value) argumentError = new Error('--data-dir 不能为空。');
    else data = path.resolve(value);
  }
}
const logs = path.join(data, 'logs');
let payload, window, frontendUrl = '', backendUrl = '';
let quitting = false, exitAllowed = false, busy = false, cycle = null;
let monitor = null, failing = false;
const owned = new Set();
let exitCode = 0;

// Set before ready / requestSingleInstanceLock: Chromium never writes to the
// immutable installation, and data-dir instances have independent profiles.
app.setName('MINOS');
app.setPath('userData', path.join(data, 'browser'));
app.setPath('sessionData', path.join(data, 'browser'));

function log(message) {
  try {
    fs.mkdirSync(logs, { recursive: true });
    fs.appendFileSync(path.join(logs, 'desktop.log'), `${new Date().toISOString()} ${message}\n`);
  } catch (error) { console.error('MINOS 日志写入失败:', error.message); }
}
function writeSmoke(result) {
  fs.mkdirSync(data, { recursive: true });
  fs.writeFileSync(path.join(data, 'smoke-test.json'), JSON.stringify({
    checkedAt: new Date().toISOString(), frontendUrl, backendUrl,
    onlineRecognitionVerified: false,
    note: 'SpeechRecognition constructor presence is not proof of online recognition availability.',
    ...result,
  }, null, 2), { mode: 0o600 });
}
function configuration() {
  for (const directory of [data, logs, path.join(data, 'temp'), path.join(data, 'gateway')]) {
    fs.mkdirSync(directory, { recursive: true });
  }
  try {
    fs.writeFileSync(path.join(data, '.env'),
      '# MINOS local configuration. Save, then restart services from the menu.\r\n' +
      `SECRET_KEY=${crypto.randomBytes(48).toString('hex')}\r\n` +
      'SEED_DEMO_DATA=false\r\nDEBUG=false\r\n' +
      '# Bring your own provider credentials. No provider keys are shipped.\r\n' +
      'LLM_API_KEY=\r\nLLM_BASE_URL=\r\nLLM_MODEL=\r\nINTERVIEW_LLM_MODEL=\r\n' +
      'MINERU_API_KEY=\r\nMAMBO_TTS_KEY=\r\n', { flag: 'wx', mode: 0o600 });
  } catch (error) { if (error.code !== 'EEXIST') throw error; }
}
function findPayload() {
  if (!app.isPackaged && process.env.MINOS_PAYLOAD) {
    if (!path.isAbsolute(process.env.MINOS_PAYLOAD)) throw new Error('开发模式 MINOS_PAYLOAD 必须是绝对路径。');
    return path.resolve(process.env.MINOS_PAYLOAD);
  }
  return path.join(process.resourcesPath, 'payload');
}
function requireFile(relative) {
  const file = path.join(payload, relative);
  if (!fs.statSync(file, { throwIfNoEntry: false })?.isFile()) throw new Error(`安装资源缺失：${file}`);
  return file;
}
function serviceEnvironment() {
  const env = {};
  const basic = ['SystemRoot', 'WINDIR', 'SystemDrive', 'COMSPEC', 'PATHEXT', 'OS',
    'NUMBER_OF_PROCESSORS', 'PROCESSOR_ARCHITECTURE', 'ProgramFiles', 'ProgramFiles(x86)',
    'ProgramW6432', 'LOCALAPPDATA', 'APPDATA', 'USERPROFILE', 'HOMEDRIVE', 'HOMEPATH',
    'USERNAME', 'USERDOMAIN'];
  for (const name of basic) {
    const key = Object.keys(process.env).find(k => k.toLowerCase() === name.toLowerCase());
    if (key && process.env[key]) env[name] = process.env[key];
  }
  const windows = env.SystemRoot || env.WINDIR || 'C:\\Windows';
  return Object.assign(env, {
    TEMP: path.join(data, 'temp'), TMP: path.join(data, 'temp'),
    PATH: [path.join(payload, 'runtime', 'node'), path.join(payload, 'runtime', 'python'),
      path.join(windows, 'System32'), windows].join(path.delimiter),
    MINOS_DATA_DIR: data, MINOS_APP_ROOT: payload, MINOS_DESKTOP: '1', MINOS_GATEWAY: '1',
    MINOS_API_BASE_URL: backendUrl, MINOS_GATEWAY_SESSION_DIR: path.join(data, 'gateway'),
    MINOS_LATEX_CACHE: path.join(data, 'runtime', 'latex-cache'),
  });
}

// Electron owns the exact service PIDs; normal shutdown terminates their process trees.
function startService(name, exe, args, cwd, signal) {
  if (signal.aborted || quitting) throw new Error('启动已取消。');
  const env = serviceEnvironment();
  const output = fs.openSync(path.join(logs, `${name}.log`), 'a');
  let child;
  try {
    child = spawn(exe, args, {
      cwd, env, windowsHide: true, shell: false, stdio: ['pipe', output, output],
    });
  } finally { fs.closeSync(output); }
  const record = { name, child, exited: false, stopping: false, error: null };
  owned.add(record);
  child.stdin.on('error', error => { if (!record.stopping) log(`${name} lifetime pipe: ${error.message}`); });
  child.on('error', error => { record.error = error; log(`${name} spawn failed: ${error.message}`); });
  child.on('exit', (code, sig) => {
    record.exited = true;
    log(`${name} supervisor exited: code=${code}, signal=${sig || '-'}`);
    if (!record.stopping && !quitting && !signal.aborted && !busy) {
      void fail(new Error(`${name} 服务意外退出，请查看 ${name}.log。`));
    }
  });
  // Keep the owned service's stdin open until shutdown.
  log(`Started owned ${name} supervisor PID ${child.pid || 'pending'}`);
}
async function stopServices() {
  clearInterval(monitor); monitor = null;
  const records = [...owned];
  for (const record of records) {
    record.stopping = true;
    record.child.stdin.destroy(); // Close input before terminating the owned tree.
  }
  await Promise.all(records.map(record => new Promise(resolve => {
    if (record.exited || !record.child.pid) { owned.delete(record); resolve(); return; }
    let settled = false;
    const finish = () => { if (!settled) { settled = true; clearTimeout(timer); owned.delete(record); resolve(); } };
    record.child.once('exit', finish);
    const timer = setTimeout(() => {
      // Only this still-live original supervisor PID, never process names or ports.
      if (record.exited) { finish(); return; }
      log(`Forcing owned ${record.name} tree cleanup (PID ${record.child.pid})`);
      const taskkill = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'taskkill.exe');
      const killer = spawn(taskkill, ['/PID', String(record.child.pid), '/T', '/F'],
        { windowsHide: true, shell: false, stdio: 'ignore', env: serviceEnvironment() });
      killer.once('error', error => { log(`Cleanup failed: ${error.message}`); finish(); });
      killer.once('exit', code => { if (code && !record.exited) log(`taskkill failed: ${code}`); finish(); });
    }, 5000);
  })));
}
async function freePort(preferred, excluded = 0) {
  const probe = port => new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen({ host: '127.0.0.1', port, exclusive: true }, () => {
      const actual = server.address().port;
      server.close(error => error ? reject(error) : resolve(actual));
    });
  });
  let port;
  try { port = await probe(preferred); }
  catch (error) { if (error.code !== 'EADDRINUSE' && error.code !== 'EACCES') throw error; port = await probe(0); }
  while (port === excluded) port = await probe(0);
  return port;
}
function get(url, signal) {
  return new Promise((resolve, reject) => {
    const request = http.get(url, { signal, timeout: 2000, agent: false }, response => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', chunk => {
        body += chunk;
        if (body.length > 1024 * 1024) request.destroy(new Error('健康响应过大。'));
      });
      response.on('error', reject);
      response.on('end', () => resolve({ status: response.statusCode, body }));
    });
    request.once('timeout', () => request.destroy(new Error('HTTP 超时。')));
    request.once('error', reject);
  });
}
function checkOwned(signal) {
  if (signal.aborted || quitting) throw new Error('启动已取消。');
  for (const record of owned) {
    if (record.error || record.exited) throw new Error(`${record.name} 无法运行，请查看日志。`);
  }
}
async function healthy(url, backend, signal, timeout = 120000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    checkOwned(signal);
    try {
      const response = await get(url, signal);
      if (response.status === 200) {
        if (!backend) return;
        const json = JSON.parse(response.body);
        if (json.status === 'ok' && json.service === 'xiaomin-backend') return;
      }
    } catch (error) { if (signal.aborted) throw error; }
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  throw new Error(`服务健康检查超时：${url}`);
}
function localUrl(value) {
  try { return Boolean(frontendUrl) && new URL(value).origin === frontendUrl; }
  catch { return false; }
}
function trustedContents(contents) {
  return window && !window.isDestroyed() && contents === window.webContents && localUrl(contents.getURL());
}
async function openExternal(value) {
  let url;
  try { url = new URL(value); } catch { return; }
  if (url.protocol !== 'https:' || url.username || url.password) return;
  const answer = await dialog.showMessageBox(window, {
    type: 'question', title: '打开外部链接', message: '是否在系统浏览器打开此 HTTPS 链接？',
    detail: url.href, buttons: ['取消', '打开'], defaultId: 0, cancelId: 0, noLink: true,
  });
  if (answer.response === 1 && !quitting) await shell.openExternal(url.href);
}
function permissions() {
  const approved = new Map();
  session.defaultSession.setPermissionCheckHandler((contents, permission, origin, details) => {
    if (!trustedContents(contents) || !localUrl(origin)) return false;
    if (details?.embeddingOrigin && !localUrl(details.embeddingOrigin)) return false;
    // Plain-text copy uses this write-only permission. Never grant clipboard
    // reads (clipboard-read / clipboard-read-write), even to the local page.
    if (permission === 'clipboard-sanitized-write') return details?.isMainFrame !== false;
    if (permission !== 'media') return false;
    const type = details?.mediaType;
    // This is an origin/type boundary check; the request handler below obtains user consent.
    return type === 'audio' || type === 'video';
  });
  session.defaultSession.setPermissionRequestHandler((contents, permission, callback, details) => {
    if (permission === 'clipboard-sanitized-write') {
      callback(Boolean(trustedContents(contents) && details?.isMainFrame !== false &&
        details?.requestingUrl && localUrl(details.requestingUrl)));
      return;
    }
    const types = details.mediaTypes || [];
    if (!trustedContents(contents) || permission !== 'media' || !types.length ||
      types.some(type => type !== 'audio' && type !== 'video') ||
      (details.requestingUrl && !localUrl(details.requestingUrl)) || details.isMainFrame === false) {
      callback(false); return;
    }
    const grantKey = `${contents.id}:${new URL(contents.getURL()).origin}`;
    if (types.every(type => approved.get(grantKey)?.has(type))) { callback(true); return; }
    const requested = types.map(type => type === 'audio' ? '麦克风 (microphone)' : '摄像头 (camera)').join('、');
    void dialog.showMessageBox(window, {
      type: 'question', title: 'MINOS 设备权限', message: `允许本机 MINOS 页面使用${requested}？`,
      detail: '仅授权当前本机窗口；系统隐私设置仍可能阻止设备访问。',
      buttons: ['拒绝', '允许'], defaultId: 0, cancelId: 0, noLink: true,
    }).then(answer => {
      const allow = answer.response === 1 && trustedContents(contents) && !quitting;
      if (allow) { const grants = approved.get(grantKey) || new Set(); types.forEach(type => grants.add(type)); approved.set(grantKey, grants); contents.once('destroyed', () => approved.delete(grantKey)); }
      callback(allow);
    }).catch(() => callback(false));
  });
  session.defaultSession.setDevicePermissionHandler(() => false);
}
let restoreWindowBounds = null;
function toggleWindowMaximize() {
  if (!window || window.isDestroyed()) return;
  if (restoreWindowBounds) {
    const bounds = restoreWindowBounds;
    restoreWindowBounds = null;
    window.setBounds(bounds);
  } else {
    if (window.isMaximized()) window.unmaximize();
    restoreWindowBounds = window.getBounds();
    window.setBounds(screen.getDisplayMatching(restoreWindowBounds).workArea);
  }
  window.webContents.send('minos:window-state', Boolean(restoreWindowBounds));
}
function createWindow() {
  restoreWindowBounds = null;
  const workArea = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea;
  const width = Math.min(1280, workArea.width);
  const height = Math.min(860, workArea.height);
  window = new BrowserWindow({
    x: workArea.x + Math.floor((workArea.width - width) / 2),
    y: workArea.y + Math.floor((workArea.height - height) / 2),
    width, height, minWidth: Math.min(640, width), minHeight: Math.min(480, height), title: 'MINOS', show: !smoke,
    icon: path.join(payload, 'pi-web', 'public', 'icons', 'minos-logo.ico'),
    frame: false,
    thickFrame: false,
    backgroundColor:'#f8fafb', autoHideMenuBar:true,
    webPreferences: { preload:path.join(__dirname,'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true,
      webSecurity: true, allowRunningInsecureContent: false, webviewTag: false },
  });
  window.setMenu(null);
  // Windows frameless maximize includes invisible resize borders beyond the
  // work area. Use work-area bounds for custom maximize instead of that path.
  window.on('maximize', () => { window.unmaximize(); if (!restoreWindowBounds) toggleWindowMaximize(); });
  const publishWindowState = () => window?.webContents.send('minos:window-state', Boolean(restoreWindowBounds) || window.isMaximized());
  window.on('maximize', publishWindowState);
  window.on('unmaximize', publishWindowState);
  const contents = window.webContents;
  contents.setWindowOpenHandler(({ url }) => { void openExternal(url).catch(fail); return { action: 'deny' }; });
  contents.on('will-navigate', (event, url) => {
    if (!localUrl(url)) { event.preventDefault(); void openExternal(url).catch(fail); }
  });
  contents.on('will-redirect', (event, url) => { if (!localUrl(url)) event.preventDefault(); });
  contents.on('will-frame-navigate', (event, details) => {
    if (!localUrl(typeof details === 'string' ? details : details.url)) event.preventDefault();
  });
  contents.on('will-attach-webview', event => event.preventDefault());
  contents.on('render-process-gone', (_event, details) => {
    if (!quitting) void fail(new Error(`界面进程退出：${details.reason}`));
  });
  window.on('closed', () => { window = null; });
}
async function openPath(target) {
  try {
    const error = await shell.openPath(target);
    if (error) throw new Error(error);
  } catch (error) {
    // A missing file association/Explorer failure must not stop healthy services.
    log(`Open path warning: ${error.message}`);
    const options = { type: 'warning', title: 'MINOS 无法打开路径',
      message: '无法使用系统应用打开此路径。', detail: `${target}\n${error.message}`, buttons: ['确定'] };
    if (window && !window.isDestroyed()) dialog.showMessageBoxSync(window, options);
    else dialog.showMessageBoxSync(options);
  }
}
ipcMain.on('minos:window-control', (event, action) => {
  if (event.sender !== window?.webContents || !trustedContents(event.sender)) return;
  if (action === 'minimize') window.minimize();
  else if (action === 'maximize') toggleWindowMaximize();
  else if (action === 'close') window.close();
});
ipcMain.on('minos:application-menu', event => {
  if (event.sender !== window?.webContents || !trustedContents(event.sender)) return;
  Menu.getApplicationMenu()?.popup({ window });
});
function menu() {
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: 'MINOS', submenu: [
      { label: '打开数据目录', click: () => void openPath(data) },
      { label: '打开配置 (.env)', click: () => void openPath(path.join(data, '.env')) },
      { label: '打开日志目录', click: () => void openPath(logs) },
      { type: 'separator' },
      { label: '重启服务', click: () => { if (!busy && !quitting) void startCycle(); } },
      { label: '退出', accelerator: 'Alt+F4', click: () => app.quit() },
    ] },
    { label: '编辑', submenu: [{ role: 'undo' }, { role: 'redo' }, { type: 'separator' },
      { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }] },
    { label: '视图', submenu: [{ role: 'reload' }, { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }] },
  ]));
}
async function smokeTest(signal) {
  const capabilities = await window.webContents.executeJavaScript(`(() => ({
    title: document.title,
    speechSynthesis: typeof window.speechSynthesis === 'object' && typeof window.speechSynthesis.speak === 'function',
    SpeechRecognition: typeof window.SpeechRecognition === 'function',
    webkitSpeechRecognition: typeof window.webkitSpeechRecognition === 'function'
  }))()`, false);
  const response = await get(`${frontendUrl}/api/minos/setup`, signal);
  let setup;
  try { setup = JSON.parse(response.body); } catch { throw new Error('Setup GET 未返回 JSON。'); }
  if (response.status !== 200 || typeof setup.setupRequired !== 'boolean') throw new Error('Setup GET 健康检查失败。');
  // Never serialize setup response wholesale: it could contain configuration.
  const result = { ok: Boolean(capabilities.title.trim()), backendHealthy: true, frontendHealthy: true,
    loadURLCompleted: true, ...capabilities, setup: { status: response.status, setupRequired: setup.setupRequired } };
  writeSmoke(result);
  if (!result.ok) throw new Error('页面 document.title 为空。');
  app.quit();
}
async function startCycle() {
  if (busy || quitting) return;
  busy = true;
  cycle?.abort();
  const controller = new AbortController(); cycle = controller;
  const signal = controller.signal;
  try {
    await stopServices();
    if (window && !window.isDestroyed()) window.destroy();
    frontendUrl = ''; backendUrl = '';
    const latexSource = path.join(payload, 'runtime', 'latex', 'cache');
    const latexCache = path.join(data, 'runtime', 'latex-cache');
    if (fs.existsSync(latexSource)) {
      fs.mkdirSync(latexCache, { recursive: true });
      // Cache contains only immutable TeX distribution assets, no user data.
      // Merge on upgrades so newly required resources are provisioned offline.
      fs.cpSync(latexSource, latexCache, { recursive: true, force: false });
    }
    const python = requireFile('runtime/python/python.exe');
    const node = requireFile('runtime/node/node.exe');
    requireFile('pi-web/.next/BUILD_ID');
    const next = requireFile('pi-web/node_modules/next/dist/bin/next');
    if (!fs.statSync(path.join(payload, 'backend', 'app'), { throwIfNoEntry: false })?.isDirectory()) {
      throw new Error('安装资源缺失：backend/app');
    }
    // CLI does not load any .env when staging excludes .env*. Refuse a
    // contaminated payload rather than ever allowing inherited/shipped keys.
    for (const folder of [payload, path.join(payload, 'pi-web'), path.join(payload, 'backend')]) {
      if (fs.readdirSync(folder).some(name => /^\.env(?:\.|$)/i.test(name))) {
        throw new Error(`安装资源不应包含 .env 文件：${folder}`);
      }
    }
    const front = await freePort(5175);
    const back = await freePort(8005, front);
    frontendUrl = `http://127.0.0.1:${front}`; backendUrl = `http://127.0.0.1:${back}`;
    startService('backend', python, ['-u', '-X', 'utf8', '-B', '-m', 'uvicorn', 'app.main:app',
      '--host', '127.0.0.1', '--port', String(back), '--no-access-log'], path.join(payload, 'backend'), signal);
    await healthy(`${backendUrl}/health`, true, signal);
    startService('frontend', node, [next, 'start', '--hostname', '127.0.0.1', '--port', String(front)],
      path.join(payload, 'pi-web'), signal);
    await healthy(`${frontendUrl}/login`, false, signal);
    await healthy(`${backendUrl}/health`, true, signal, 15000);
    checkOwned(signal);
    createWindow();
    await window.loadURL(`${frontendUrl}/login`);
    checkOwned(signal);
    exitCode = 0;
    log(`Services ready: ${frontendUrl}, ${backendUrl}`);
    if (smoke) await smokeTest(signal);
    else {
      let checking = false;
      monitor = setInterval(async () => {
        if (checking || quitting || signal.aborted || busy) return;
        checking = true;
        try {
          checkOwned(signal);
          await healthy(`${backendUrl}/health`, true, signal, 10000);
          await healthy(`${frontendUrl}/login`, false, signal, 10000);
        } catch (error) { if (!quitting && !signal.aborted) await fail(error); }
        finally { checking = false; }
      }, 15000);
    }
  } catch (error) { if (!quitting) await fail(error); }
  finally { busy = false; }
}
async function fail(error) {
  if (failing || quitting) return;
  failing = true; exitCode = 1;
  cycle?.abort();
  log(`ERROR: ${error?.message || error}`);
  try {
    await stopServices();
    const message = String(error?.message || error);
    if (smoke) {
      writeSmoke({ ok: false, error: message, logs });
      app.quit();
    } else {
      dialog.showErrorBox('MINOS 启动或运行失败', `${message}\n\n日志目录：${logs}\n可通过 MINOS 菜单打开配置、日志并重启服务。`);
      // Keep the application menu available for configuration/retry.
      if (!window || window.isDestroyed()) {
        createWindow();
        const html = '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>MINOS 启动失败</title></head>' +
          '<body><h1>MINOS 启动失败</h1><p>请查看错误对话框中的日志目录。可通过上方 MINOS 菜单打开配置并重启服务。</p></body></html>';
        await window.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
      }
    }
  } catch (reportError) {
    console.error('MINOS 错误报告失败:', reportError.message);
    dialog.showErrorBox('MINOS 失败', `${error?.message || error}\n日志目录：${logs}\n错误报告：${reportError.message}`);
    app.quit();
  } finally { failing = false; }
}

app.on('before-quit', event => {
  if (exitAllowed) return;
  event.preventDefault();
  if (quitting) return;
  quitting = true; cycle?.abort();
  void stopServices().finally(() => { exitAllowed = true; app.exit(exitCode); });
});
app.on('window-all-closed', () => { if (!busy && !failing) app.quit(); });
app.on('second-instance', () => {
  if (window && !window.isDestroyed()) { if (window.isMinimized()) window.restore(); window.show(); window.focus(); }
});
process.on('uncaughtException', error => { void fail(error); });
process.on('unhandledRejection', error => { void fail(error); });
process.on('SIGINT', () => app.quit());
process.on('SIGTERM', () => app.quit());

if (!app.requestSingleInstanceLock()) {
  // Do not overwrite an active instance's smoke report/configuration.
  exitAllowed = true; app.exit(2);
} else {
  void app.whenReady().then(async () => {
    if (argumentError) throw argumentError;
    if (process.platform !== 'win32') throw new Error('此桌面启动器需要 Windows。');
    configuration(); payload = findPayload();
    menu(); permissions();
    await startCycle();
  }).catch(fail);
}
