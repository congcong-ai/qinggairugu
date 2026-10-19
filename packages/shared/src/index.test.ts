import { describe, it, expect } from 'vitest';
import {
  transitionSession,
  defaultSessionTitle,
  canViewParticipants,
  formatDuration,
} from './index';
describe('Session 规则', () => {
  it('暂停后可以继续，完成不能直接暂停', () => {
    expect(transitionSession('paused', 'recording')).toBe('recording');
    expect(() => transitionSession('completed', 'paused')).toThrow();
  });
  it('自动标题无需输入', () => {
    expect(defaultSessionTitle(new Date(2026, 9, 17, 14, 32))).toBe(
      '10月17日 14:32 的记录',
    );
  });
  it('限制本场参与者资料访问', () => {
    expect(canViewParticipants('everyone', false, false)).toBe(false);
    expect(canViewParticipants('everyone', false, true)).toBe(true);
    expect(canViewParticipants('organizer_only', false, true)).toBe(false);
    expect(canViewParticipants('organizer_only', true, false)).toBe(true);
  });
  it('录音时长', () => {
    expect(formatDuration(61000)).toBe('01:01');
  });
});

it('发言人不能关联其它场的参与者', async () => {
  const { assertSameSession } = await import('./index');
  expect(() => assertSameSession('a', 'b')).toThrow();
  expect(() => assertSameSession('a', 'a')).not.toThrow();
});
