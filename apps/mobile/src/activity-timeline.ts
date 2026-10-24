import type { ActivityItem } from '@pengtou/contracts';
import type { LocalSession } from './storage/database';
export interface TimelineItem extends ActivityItem {
  localRecords: LocalSession[];
}
/** 活动分组只使用明确 ID 引用，不按标题或日期合并私人记录。 */
export function activityTimeline(
  local: LocalSession[],
  cloud: ActivityItem[],
): TimelineItem[] {
  const groups = new Map<string, TimelineItem>();
  for (const item of cloud) {
    const key = item.sessionId
      ? `session:${item.sessionId}`
      : `private:${item.id}`;
    const existing = groups.get(key);
    if (existing)
      existing.entryIds = [
        ...new Set([...existing.entryIds, ...item.entryIds]),
      ];
    else
      groups.set(key, {
        ...item,
        entryIds: [...item.entryIds],
        localRecords: [],
      });
  }
  for (const record of local) {
    const key = record.cloud_id
      ? `session:${record.cloud_id}`
      : `private:${record.id}`;
    let group = groups.get(key);
    if (!group) {
      group = {
        id: key,
        title: record.title,
        occurredAt: record.occurred_at ?? record.created_at,
        relation: 'private',
        sessionId: record.cloud_id,
        entryIds: [],
        localRecords: [],
      };
      groups.set(key, group);
    }
    group.localRecords.push(record);
  }
  return [...groups.values()].sort((a, b) =>
    b.occurredAt.localeCompare(a.occurredAt),
  );
}
