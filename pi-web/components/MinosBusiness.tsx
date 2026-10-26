"use client";
import { useCallback, useEffect, useRef, useState } from 'react';
import './minos-business.css';

const PAGES = [
  { path: '/chat', label: '智能对话', mark: '◇' },
  { path: '/resume', label: 'LaTeX 简历', mark: '▤' },
  { path: '/knowledge', label: '知识库', mark: '▧' },
  { path: '/interview', label: 'AI 面试', mark: '◎' },
  { path: '/review', label: '学习复盘', mark: '◷' },
];
export function isMinosPath(path: unknown): path is string {
  return typeof path === 'string' && path.length < 500 && /^\/(home|chat|resume|knowledge(?:\/(?:college|major)\/[a-zA-Z0-9_-]+)?|guide\/[a-zA-Z0-9_-]+|interview(?:\/room)?|career|review|onboarding|chat-legacy|resume-legacy)$/.test(path);
}
const canonicalPath = (path: string) => path === '/home' || path === '/career' ? '/chat' : path;
const chatPath = (path: string) => path === '/chat' || path === '/resume';
export function useMinosBusiness(initialPath: string) {
  const [path, setPath] = useState(isMinosPath(initialPath) ? canonicalPath(initialPath) : '/chat');
  const [origin, setOrigin] = useState('');
  const businessFrame = useRef<HTMLIFrameElement | null>(null);
  const parentOrigin = useRef('');
  const navigate = useCallback((next: string) => {
    if (!isMinosPath(next)) return;
    next = canonicalPath(next);
    setPath(next);
    if (window.parent !== window && parentOrigin.current) window.parent.postMessage({ type: 'minos:navigate', path: next }, parentOrigin.current);
  }, []);
  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (event.source === window.parent && window.parent !== window && event.data?.type === 'minos:host') {
        // Only the loopback MINOS embedding parent can configure business origin.
        let url: URL; try { url = new URL(event.origin); } catch { return; }
        if (!['127.0.0.1', 'localhost'].includes(url.hostname) || event.data.origin !== event.origin) return;
        parentOrigin.current = event.origin;
        setOrigin(event.origin);
        if (isMinosPath(event.data.path)) {
          setPath(canonicalPath(event.data.path));
          if (canonicalPath(event.data.path) !== event.data.path) window.parent.postMessage({type:'minos:navigate',path:'/chat'}, event.origin);
        }
      }
      if (origin && event.origin === origin && event.source === businessFrame.current?.contentWindow && event.data?.type === 'minos:business-navigate' && isMinosPath(event.data.path)) navigate(event.data.path);
    };
    window.addEventListener('message', receive);
    if (window.parent !== window) {
      // The ticket exchange intentionally strips Referer. This readiness ping
      // contains no data; the authenticated parent reply is origin/source checked.
      window.parent.postMessage({ type: 'minos:host-ready' }, '*');
    }
    return () => window.removeEventListener('message', receive);
  }, [navigate, origin]);
  return { path, navigate, origin, businessFrame, isChat: chatPath(path) };
}
export function MinosBusinessNavigation({ path, onNavigate }: { path: string; onNavigate: (path: string) => void }) {
  return <nav className="minos-business-nav" aria-label="求职导航">{PAGES.map(page => <button key={page.path} aria-current={path === page.path || page.path === '/knowledge' && (path.startsWith('/knowledge/') || path.startsWith('/guide/')) ? 'page' : undefined} onClick={() => onNavigate(page.path)}><span aria-hidden="true">{page.mark}</span>{page.label}</button>)}</nav>;
}
export function MinosBusinessContent({ path, origin, frameRef, onSidebarToggle }: { path: string; origin: string; frameRef: React.RefObject<HTMLIFrameElement | null>; onSidebarToggle: () => void }) {
  const initialFramePath = useRef(path);
  useEffect(() => { if (origin) frameRef.current?.contentWindow?.postMessage({type:'minos:business-route',path}, origin); }, [path, origin, frameRef]);
  const label = PAGES.find(p => p.path === path)?.label ?? (path.startsWith('/guide/') ? '知识章节' : '求职工作区');
  const syncTheme = useCallback(() => frameRef.current?.contentWindow?.postMessage({ type: 'minos:theme', dark: document.documentElement.classList.contains('dark') || document.documentElement.dataset.theme === 'dark' }, origin), [frameRef, origin]);
  useEffect(() => { const observer = new MutationObserver(syncTheme); observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme'] }); return () => observer.disconnect(); }, [syncTheme]);
  return <section className="minos-business-content"><header><button aria-label="展开或收起导航" onClick={onSidebarToggle}>☰</button><span>{label}</span><small>MINO AGENT</small></header>{origin ? <iframe ref={frameRef} title={label} referrerPolicy="origin" src={`${origin}/?piEmbed=1#${initialFramePath.current}`} onLoad={syncTheme} allow="microphone; camera; clipboard-write" /> : <p role="status" className="minos-business-loading">正在连接求职平台…请从 MINOS 入口打开工作区。</p>}</section>;
}
