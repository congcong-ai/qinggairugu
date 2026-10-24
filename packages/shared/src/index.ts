import type { SessionState } from '@pengtou/contracts';
const transitions: Record<SessionState, readonly SessionState[]> = {
  ready: ['recording'],
  recording: ['paused', 'completed', 'interrupted'],
  paused: ['recording', 'completed', 'interrupted'],
  interrupted: ['recording', 'completed'],
  completed: ['recording'],
};
export function transitionSession(
  from: SessionState,
  to: SessionState,
): SessionState {
  if (!transitions[from].includes(to)) throw new Error('无效的录音状态变更');
  return to;
}
export function defaultSessionTitle(date = new Date()): string {
  const p = (v: number) => String(v).padStart(2, '0');
  return `${date.getMonth() + 1}月${date.getDate()}日 ${p(date.getHours())}:${p(date.getMinutes())} 的记录`;
}
export function formatDuration(ms: number): string {
  const seconds = Math.floor(Math.max(0, ms) / 1000);
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}
export function canViewParticipants(
  visibility: 'everyone' | 'organizer_only',
  isOrganizer: boolean,
  hasJoined: boolean,
): boolean {
  return isOrganizer || (hasJoined && visibility === 'everyone');
}

export function assertSameSession(
  speakerSessionId: string,
  participantSessionId: string,
) {
  if (speakerSessionId !== participantSessionId)
    throw new Error('只能匹配本场参与者');
}

/** 日期表单使用设备本地日历，不能截取 UTC ISO 日期。 */
export function localDateInput(date = new Date()): string {
  if (!Number.isFinite(date.getTime())) throw new Error('日期不正确');
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${String(date.getFullYear()).padStart(4, '0')}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
/** 日记只有日期，没有精确发生时刻；以本地中午保存，回显仍按本地日历。 */
export function dateInputToISOString(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value))
    throw new Error('请按 YYYY-MM-DD 填写日期');
  const date = new Date(value + 'T12:00:00');
  if (!Number.isFinite(date.getTime()) || localDateInput(date) !== value)
    throw new Error('日期不存在，请检查月份和天数');
  return date.toISOString();
}
