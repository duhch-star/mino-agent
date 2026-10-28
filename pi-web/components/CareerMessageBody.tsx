"use client";

import { useMemo } from 'react';
import { CareerGeneratedUI } from './CareerGeneratedUI';
import { parseCareerUI } from '@/lib/career-ui';

/** Model output is data only: no HTML, scripts or model-authored React. */
export function CareerMessageBody({ text, isStreaming, sessionId, renderText }: {
  text: string;
  isStreaming?: boolean;
  sessionId?: string;
  renderText: (text: string) => React.ReactNode;
}) {
  const parsed = useMemo(() => parseCareerUI(text), [text]);
  const chooseAction = (prompt: string) => {
    // Scope to the visible session so a stale/background card cannot send or
    // alter the composer of another chat. Only fill a draft; never auto-send.
    if (!sessionId) return;
    window.dispatchEvent(new CustomEvent('minos:career-draft', { detail: { sessionId, prompt } }));
  };
  return <>{parsed.segments.map((segment, index) => segment.kind === 'text'
    ? <div key={index}>{renderText(segment.text)}</div>
    : <CareerGeneratedUI key={index} data={segment.data} onAction={sessionId ? chooseAction : undefined} />)}
    {parsed.pending && <div className="minos-ui-pending" role="status">{isStreaming ? '正在整理求职分析卡片…' : '卡片内容尚未完整生成，请重试或要求用文字展示。'}</div>}
  </>;
}
