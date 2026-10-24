import { expect, it } from 'vitest';
import { activityTimeline } from './activity-timeline';
import type { LocalSession } from './storage/database';
import type { ActivityItem } from '@pengtou/contracts';
const local = (id: string, sid: string | null = null): LocalSession => ({
  id,
  cloud_id: sid,
  title: '同名活动',
  created_at: '2026-10-22',
  state: 'ready',
  duration_ms: 0,
});
const cloud: ActivityItem = {
  id: 'shared',
  sessionId: 'shared',
  title: '共享活动',
  occurredAt: '2026-10-22',
  relation: 'participant',
  entryIds: ['entry-a', 'entry-b'],
};
it('同场多份本机记录全部可打开，云端私人心得 ID 原样保留', () => {
  const result = activityTimeline(
    [local('a', 'shared'), local('b', 'shared')],
    [cloud],
  );
  expect(result).toHaveLength(1);
  expect(result[0]?.localRecords.map((r) => r.id)).toEqual(['a', 'b']);
  expect(result[0]?.entryIds).toEqual(['entry-a', 'entry-b']);
  expect(result[0]?.relation).toBe('participant');
});
it('离线仍按显式引用分组且保留每份本机记录', () => {
  expect(
    activityTimeline([local('a', 'shared'), local('b', 'shared')], [])[0]
      ?.localRecords,
  ).toHaveLength(2);
});
it('同名私人记录不自动合并，不把空云端引用匹配到其它记录', () => {
  expect(
    activityTimeline(
      [local('a'), local('b')],
      [{ ...cloud, sessionId: null, id: 'other' }],
    ),
  ).toHaveLength(3);
});
it('生成时间线不修改原始云端与本地数据', () => {
  const before = JSON.stringify(cloud);
  activityTimeline(
    [local('a', 'shared')],
    [cloud, { ...cloud, id: 'duplicate', entryIds: ['entry-c'] }],
  );
  expect(JSON.stringify(cloud)).toBe(before);
});

it('私人记录按填写的活动日期排序，兼容没有活动日期的旧数据', () => {
  const later = { ...local('later'), occurred_at: '2026-11-01' };
  const earlier = { ...local('earlier'), occurred_at: '2026-01-01' };
  expect(
    activityTimeline([earlier, local('legacy'), later], []).map(
      (r) => r.localRecords[0]!.id,
    ),
  ).toEqual(['later', 'legacy', 'earlier']);
});
