'use strict';
const { ipcRenderer } = require('electron');
window.addEventListener('DOMContentLoaded', () => {
  const header = document.createElement('header');
  header.id = 'minos-desktop-chrome';
  header.innerHTML = `<div class="desktop-identity"><img src="/icons/minos-avatar.svg" alt=""/><strong>MINOS</strong><span class="desktop-divider"></span><span class="desktop-tagline">你的 AI 求职搭档</span></div><button type="button" class="desktop-menu" aria-label="应用菜单" title="应用菜单">···</button>`;
  const css = document.createElement('style');
  css.textContent = `
    html { --desktop-chrome-height:52px; }
    body { padding-top:52px!important; box-sizing:border-box!important; height:100dvh!important; }
    #minos-desktop-chrome { position:fixed; inset:0 0 auto; height:52px; z-index:2147483000; display:flex; align-items:center; justify-content:space-between; padding:0 154px 0 22px; box-sizing:border-box; background:var(--bg,#f8fafb); color:var(--text,#213547); border-bottom:1px solid var(--border,#e5e9ec); -webkit-app-region:drag; user-select:none; font-family:system-ui,-apple-system,'Segoe UI',sans-serif; }
    .desktop-identity { display:flex;align-items:center;gap:12px;white-space:nowrap; }
    .desktop-identity img { width:32px;height:32px;object-fit:contain; }
    .desktop-identity strong { font-size:14px;letter-spacing:2px;font-weight:700; }
    .desktop-divider { height:14px;width:1px;background:var(--border,#dbe3e8);margin:0 3px; }
    .desktop-tagline { font-size:11px;color:var(--text-muted,#7b8996);letter-spacing:1px; }
    .desktop-menu { -webkit-app-region:no-drag; border:0;background:transparent;color:inherit;border-radius:7px;width:36px;height:30px;font-size:24px;line-height:16px;cursor:pointer; }
    .desktop-menu:hover { background:var(--bg-hover,#e9eef2); }
    .app,.minos-unified-workspace { height:calc(100dvh - 52px)!important; }
    .minos-account-bar > strong { visibility:hidden; }
    .minos-permission-backdrop,.minos-model-settings { top:52px!important; }
    .minos-model-settings .config-panel-root.is-modal { top:52px!important; }
    .web-login-page { min-height:0!important;height:calc(100dvh - 52px)!important; }
    @media(max-width:900px) { .desktop-tagline,.desktop-divider {display:none;} }
  `;
  document.head.appendChild(css);
  document.body.appendChild(header);
  header.querySelector('button').addEventListener('click', () => ipcRenderer.send('minos:application-menu'));
});
