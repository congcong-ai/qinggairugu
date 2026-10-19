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
