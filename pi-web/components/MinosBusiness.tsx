"use client";
import { useCallback, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import './minos-business.css';
const BusinessPages = dynamic(() => import('./minos/BusinessPages'), { ssr: false });
const PAGES = [
  { path: '/chat', label: '智能对话', mark: '◇' },
  { path: '/resume', label: 'LaTeX 简历', mark: '▤' },
  { path: '/knowledge', label: '知识库', mark: '▧' },
  { path: '/interview', label: 'AI 面试', mark: '◎' },
  { path: '/review', label: '学习复盘', mark: '◷' },
  { path: '/onboarding', label: '求职画像', mark: '♙' },
];
export function isMinosPath(path: unknown): path is string {
  return typeof path === 'string' && path.length < 500 && /^\/(home|chat|resume|knowledge(?:\/(?:college|major)\/[a-zA-Z0-9_-]+)?|guide\/[a-zA-Z0-9_-]+|interview(?:\/room)?|career|review|admin\/review|onboarding|chat-legacy|resume-legacy)$/.test(path);
}
const canonicalPath = (path: string) => ['/home', '/career', '/chat-legacy'].includes(path) ? '/chat' : path === '/resume-legacy' ? '/resume' : path;
export function useMinosBusiness(initialPath: string) {
  const [path, setPath] = useState(isMinosPath(initialPath) ? canonicalPath(initialPath) : '/chat');
  const navigate = useCallback((next: string) => {
    if (!isMinosPath(next)) return;
    next = canonicalPath(next);
    setPath(next);
    const url = new URL(window.location.href);
    url.searchParams.set('businessPath', next);
    window.history.replaceState(null, '', url);
  }, []);
  useEffect(() => {
    const pop = () => { const next = new URL(window.location.href).searchParams.get('businessPath'); if (isMinosPath(next)) setPath(canonicalPath(next)); };
    window.addEventListener('popstate', pop);
    return () => window.removeEventListener('popstate', pop);
  }, []);
  return { path, navigate, isChat: path === '/chat' || path === '/resume' };
}
export function MinosBusinessNavigation({ path, onNavigate }: { path: string; onNavigate: (path: string) => void }) {
  return <nav className="minos-business-nav" aria-label="求职导航">{PAGES.map(page => <button key={page.path} aria-current={path === page.path || page.path === '/knowledge' && (path.startsWith('/knowledge/') || path.startsWith('/guide/')) ? 'page' : undefined} onClick={() => onNavigate(page.path)}><span aria-hidden="true">{page.mark}</span>{page.label}</button>)}</nav>;
}
export function MinosBusinessContent({ path, onNavigate, onSidebarToggle }: { path: string; onNavigate: (path: string) => void; onSidebarToggle: () => void }) {
  const label = PAGES.find(p => p.path === path)?.label ?? (path.startsWith('/guide/') ? '知识章节' : '求职工作区');
  return <section className="minos-business-content"><header><button aria-label="展开或收起导航" onClick={onSidebarToggle}>☰</button><span>{label}</span><small>MINOS</small></header><BusinessPages path={path} onNavigate={onNavigate} /></section>;
}
