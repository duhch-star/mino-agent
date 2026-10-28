'use strict';
const { ipcRenderer } = require('electron');
window.addEventListener('DOMContentLoaded', () => {
  const header = document.createElement('header');
  header.id = 'minos-desktop-chrome';
  header.innerHTML = `<div class="desktop-identity"><img src="/icons/minos-avatar.svg" alt=""/><strong>MINOS</strong><span class="desktop-divider"></span><span class="desktop-tagline">你的 AI 求职搭档</span></div><div class="desktop-actions"><button type="button" class="desktop-menu" aria-label="应用菜单" title="应用菜单">···</button><button type="button" data-window="minimize" aria-label="最小化" title="最小化"><svg viewBox="0 0 16 16"><path d="M3 8h10"/></svg></button><button type="button" data-window="maximize" aria-label="最大化" title="最大化"><svg viewBox="0 0 16 16"><rect x="3.5" y="3.5" width="9" height="9" rx="1"/></svg></button><button type="button" data-window="close" aria-label="关闭窗口" title="关闭窗口"><svg viewBox="0 0 16 16"><path d="m4 4 8 8m0-8-8 8"/></svg></button></div>`;
  const css = document.createElement('style');
  css.textContent = `
    html { --desktop-chrome-height:52px; }
    html { overflow:hidden!important; }
    body { margin:0!important; padding:52px 0 0!important; box-sizing:border-box!important; height:100dvh!important; width:100%!important; min-width:0!important; min-height:0!important; overflow:hidden!important; }
    body > :not(#minos-desktop-chrome):not(style):not(script) { flex-shrink:0; }
    body > .minos-unified-workspace, body > .app { flex:1 1 0!important;min-height:0!important;min-width:0!important; }
    #minos-desktop-chrome { position:fixed; inset:0 0 auto; height:52px; z-index:2147483000; display:flex; align-items:center; justify-content:space-between; padding:0 10px 0 22px; box-sizing:border-box; background:var(--bg,#f8fafb); color:var(--text,#213547); border-bottom:1px solid var(--border,#e5e9ec); -webkit-app-region:drag; user-select:none; font-family:system-ui,-apple-system,'Segoe UI',sans-serif; }
    #minos-desktop-chrome { min-width:0!important; overflow:hidden; flex:none!important; transform:none!important; }
    #minos-desktop-chrome .desktop-identity { display:flex;align-items:center;gap:12px;white-space:nowrap;min-width:0;overflow:hidden; }
    #minos-desktop-chrome .desktop-actions { flex:none!important;margin-left:auto;padding-left:12px; }
    .desktop-identity img { width:32px;height:32px;object-fit:contain; }
    .desktop-identity strong { font-size:14px;letter-spacing:2px;font-weight:700; }
    .desktop-divider { height:14px;width:1px;background:var(--border,#dbe3e8);margin:0 3px; }
    .desktop-tagline { font-size:11px;color:var(--text-muted,#7b8996);letter-spacing:1px; }
    .desktop-menu { -webkit-app-region:no-drag; border:0;background:transparent;color:inherit;border-radius:7px;width:36px;height:30px;font-size:24px;line-height:16px;cursor:pointer; }
    .desktop-actions { display:flex;align-items:center;gap:4px;-webkit-app-region:no-drag; }
    .desktop-actions button { -webkit-app-region:no-drag;display:grid;place-items:center;width:38px;height:32px;border:0;border-radius:8px;background:transparent;color:inherit;cursor:pointer; }
    .desktop-actions button:hover { background:var(--bg-hover,#e9eef2); }
    .desktop-actions button:focus-visible { outline:2px solid var(--accent,#527b89);outline-offset:-2px; }
    .desktop-actions button[data-window="close"]:hover { background:#c64343;color:white; }
    .desktop-actions svg { width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:1.2; }
    .app,.minos-unified-workspace { height:calc(100dvh - 52px)!important; }
    .minos-account-bar > strong { visibility:hidden; }
    .minos-permission-backdrop,.minos-model-settings { top:52px!important; }
    .config-panel-root.is-modal { top:52px!important; max-height:calc(100dvh - 52px)!important; }
    .config-panel-root.is-modal > .config-panel-surface { max-height:100%!important;min-height:0!important; }
    .minos-account-bar { flex-wrap:wrap;min-height:40px;height:auto!important;flex:none!important; }
    .minos-account-bar > span { min-width:0;overflow:hidden;text-overflow:ellipsis; }
    .minos-account-bar > button { flex:none; }
    @media(max-height:650px) { .config-panel-root.is-modal { padding:8px!important; } }
    .web-login-page { min-height:0!important;height:calc(100dvh - 52px)!important; }
    @media(max-width:900px) { .desktop-tagline,.desktop-divider {display:none;} }
  `;
  document.head.appendChild(css);
  document.body.appendChild(header);
  header.querySelector('.desktop-menu').addEventListener('click', () => ipcRenderer.send('minos:application-menu'));
  header.querySelectorAll('[data-window]').forEach(button => button.addEventListener('click', () => ipcRenderer.send('minos:window-control', button.dataset.window)));
  ipcRenderer.on('minos:window-state', (_event, maximized) => {
    const button = header.querySelector('[data-window="maximize"]');
    button.setAttribute('aria-label', maximized ? '还原窗口' : '最大化');
    button.title = maximized ? '还原窗口' : '最大化';
    button.innerHTML = maximized ? '<svg viewBox="0 0 16 16"><path d="M6 3.5h6.5V10M3.5 6h6.5v6.5H3.5z"/></svg>' : '<svg viewBox="0 0 16 16"><rect x="3.5" y="3.5" width="9" height="9" rx="1"/></svg>';
  });
});
