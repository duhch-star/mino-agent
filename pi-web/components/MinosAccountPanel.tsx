'use client';
import { useEffect, useRef, useState } from 'react';
import { fetchUsageSummary, requestApi } from './minos/api';
import { activateAccount } from './minos/store';
import './minos-account-panel.css';

type AccountUser = { id: string; name?: string; username?: string; role: string };
type Usage = { today: Record<string, number>; limit: Record<string, number>; percent: Record<string, number>; resetAt: string };
export const CLEAR_CONFIRMATION = '清除业务数据';
export function accountRoleLabel(role: string) {
  return role === 'admin' ? '管理员' : role === 'candidate' || role === 'user' || role === 'student' ? `求职者（${role}）` : role || '未提供角色';
}
export function usageNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value.toLocaleString('zh-CN') : '未提供';
}
export async function clearBusinessData(confirmation: string) {
  if (confirmation !== CLEAR_CONFIRMATION) throw new Error('请完整输入确认文字');
  const response = await requestApi('/api/users/me/data', { method: 'DELETE' });
  const result = await response.json();
  if (result.deleted !== true) throw new Error('服务端未确认删除，请刷新核对后重试');
}

export function MinosAccountPanel({ user, onClose }: { user: AccountUser; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const deleting = useRef(false);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [usageError, setUsageError] = useState('');
  const [reload, setReload] = useState(0);
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    const node = dialog.current;
    const opener = document.activeElement;
    node?.showModal();
    return () => { node?.close(); if (opener instanceof HTMLElement && opener.isConnected) opener.focus(); };
  }, []);
  useEffect(() => {
    let alive = true;
    setUsage(null); setUsageError('');
    fetchUsageSummary().then((value: Usage) => { if (alive) setUsage(value); }).catch((e: Error) => { if (alive) setUsageError(e.message || '业务额度读取失败'); });
    return () => { alive = false; };
  }, [user.id, reload]);
  const clear = async () => {
    if (deleting.current || confirmation !== CLEAR_CONFIRMATION) return;
    deleting.current = true; setBusy(true); setError('');
    try {
      // Cancel this page's delayed learning writes and stop its interview before deleting.
      await activateAccount(null);
      await clearBusinessData(confirmation);
      // Remount every business view so stale local state cannot be written back.
      window.location.reload();
    } catch (e) {
      await activateAccount(user);
      setError(`${e instanceof Error ? e.message : '清除失败'}。删除结果可能未能返回；请刷新核对数据后再试。`);
      deleting.current = false; setBusy(false); setConfirmation('');
    }
  };
  return <dialog ref={dialog} className="minos-account-panel" aria-labelledby="minos-account-title" onCancel={event => { event.preventDefault(); if (!deleting.current) onClose(); }} onClick={event => { if (event.target === event.currentTarget && !deleting.current) onClose(); }}>
    <div className="minos-account-panel-surface">
      <header><h2 id="minos-account-title">账号与数据</h2><button type="button" disabled={busy} onClick={onClose} aria-label="关闭账号与数据">关闭 ×</button></header>
      <section><h3>当前账号</h3><dl><div><dt>名称</dt><dd>{user.name || user.username || user.id}</dd></div><div><dt>角色</dt><dd>{accountRoleLabel(user.role)}</dd></div></dl></section>
      <section><h3>今日业务额度</h3><p>来自 MINOS 服务端业务计量，不等于 Pi 或模型供应商账户的全部用量。</p>
        {usageError ? <p role="alert">{usageError} <button type="button" onClick={() => setReload(value => value + 1)}>重试读取</button></p> : !usage ? <p role="status">正在读取业务额度…</p> : <><dl>{[['llmTokens', 'LLM tokens'], ['sttMinutes', '语音识别（分钟）'], ['ttsChars', '语音合成（字符）']].map(([key, label]) => <div key={key}><dt>{label}</dt><dd>{usageNumber(usage.today?.[key])} / {usageNumber(usage.limit?.[key])} · {usageNumber(usage.percent?.[key])}%</dd></div>)}</dl><p>重置时间：{usage.resetAt && Number.isFinite(Date.parse(usage.resetAt)) ? new Date(usage.resetAt).toLocaleString('zh-CN') : '服务端未提供'}</p></>}
      </section>
      <section><h3>隐私与保留范围</h3><p>麦克风和摄像头仅在面试授权后使用；请在面试页关闭设备。Pi 本地智能体按当前 Windows 用户权限运行，账号目录分离不是操作系统安全沙箱。</p><p>本面板只管理 MINOS 服务端业务记录，不管理 Pi 会话、工作区文件或模型凭据。</p></section>
      <section className="minos-account-danger"><h3>清除当前账号业务数据</h3><p id="minos-clear-scope">不可撤销：删除服务端数据库中的学习进度与测验、收藏、笔记、面试及问答、业务聊天及消息、业务简历及修订历史、附件记录。</p><p>不会删除账号及求职画像、业务额度记录、Pi 会话 JSONL、工作区文件、已生成 PDF、磁盘附件文件或模型设置/密钥。清除后会刷新本页，不会退出账号。</p><p>请先停止正在运行的任务并关闭其他 MINOS 标签页，避免其他页面或任务重新写入数据。</p><label htmlFor="minos-clear-confirmation">确认以上范围后，输入“{CLEAR_CONFIRMATION}”</label><input id="minos-clear-confirmation" aria-describedby="minos-clear-scope" value={confirmation} disabled={busy} autoComplete="off" onChange={event => setConfirmation(event.target.value)} /><button type="button" className="minos-account-delete" disabled={busy || confirmation !== CLEAR_CONFIRMATION} onClick={() => void clear()}>{busy ? '正在清除，完成后刷新…' : '永久清除业务数据'}</button>{error && <p role="alert">{error}</p>}</section>
    </div>
  </dialog>;
}
