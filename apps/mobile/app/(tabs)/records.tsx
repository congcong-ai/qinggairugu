import { activityTimeline } from '../../src/activity-timeline';
import { useCallback, useState } from 'react';
import { Text } from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import { Page, Heading, Card, Action, styles } from '../../src/ui';
import { listSessions, type LocalSession } from '../../src/storage/database';
import { refreshActivities, openCloudActivity } from '../../src/cloud';
import type { ActivityItem } from '@pengtou/contracts';
export default function Records() {
  const [local, setLocal] = useState<LocalSession[]>([]);
  const [cloud, setCloud] = useState<ActivityItem[]>([]);
  const [error, setError] = useState('');
  useFocusEffect(
    useCallback(() => {
      let live = true;
      void listSessions()
        .then((rows) => {
          if (live) setLocal(rows);
        })
        .catch(() => {
          if (live) setError('本机记录读取失败，请重新打开');
        });
      void refreshActivities()
        .then((rows) => {
          if (live) {
            setCloud(rows);
            setError('');
          }
        })
        .catch(() => {
          if (live) {
            setCloud([]);
            setError('云端活动暂不可用，本机记录仍可打开。');
          }
        });
      return () => {
        live = false;
      };
    }, []),
  );
  const cards = activityTimeline(local, cloud);
  return (
    <Page>
      <Heading title="我的活动" subtitle="我发起的、我参加的，和只属于我的。" />
      <Action label="记录一场活动" onPress={() => router.push('/start')} />
      <Action
        secondary
        label="搜索我的记录"
        onPress={() => router.push('/search')}
      />
      {!!error && <Text style={styles.caption}>{error}</Text>}
      {!cards.length && (
        <Card>
          <Text style={styles.body}>
            下一次相聚，从一段录音或几句心得开始。
          </Text>
        </Card>
      )}
      {cards.map((item) => (
        <Card key={item.id}>
          <Text style={styles.label}>{item.title}</Text>
          <Text style={styles.caption}>
            {new Date(item.occurredAt).toLocaleDateString('zh-CN')} ·{' '}
            {
              {
                organizer: '我发起的',
                participant: '我参加的',
                private: '私人记录',
              }[item.relation]
            }
            {item.localRecords.length
              ? ` · 本机 ${item.localRecords.length} 份记录`
              : ''}
          </Text>
          <Action
            secondary
            disabled={item.localRecords.length > 1}
            label={
              item.localRecords.length > 1 ? '请在下方选择本机记录' : '打开看看'
            }
            onPress={() => {
              if (item.localRecords.length === 1)
                router.push({
                  pathname: '/session/[id]',
                  params: { id: item.localRecords[0]!.id },
                });
              else if (item.localRecords.length > 1) return;
              else if (item.sessionId)
                void openCloudActivity(item.sessionId)
                  .then((id) =>
                    router.push({ pathname: '/session/[id]', params: { id } }),
                  )
                  .catch((e) => setError(e.message));
              else if (item.entryIds[0])
                router.push({
                  pathname: '/entry',
                  params: { cloudEntryId: item.entryIds[0] },
                });
              else
                router.push({
                  pathname: '/cloud-results',
                  params: { activityId: item.id },
                });
            }}
          />
          {item.localRecords.length > 1 &&
            item.localRecords.map((record) => (
              <Action
                key={record.id}
                secondary
                label={`本机记录：${record.title}`}
                onPress={() =>
                  router.push({
                    pathname: '/session/[id]',
                    params: { id: record.id },
                  })
                }
              />
            ))}
          {cloud.some((c) => c.id === item.id) && (
            <Action
              secondary
              label="我的云端整理文字（只有我可见）"
              onPress={() =>
                router.push({
                  pathname: '/cloud-results',
                  params: { activityId: item.sessionId ?? item.id },
                })
              }
            />
          )}
          {item.entryIds.map((eid) => (
            <Action
              key={eid}
              secondary
              label="我的心得（只有我可见）"
              onPress={() =>
                router.push({
                  pathname: '/entry',
                  params: { cloudEntryId: eid },
                })
              }
            />
          ))}
        </Card>
      ))}
    </Page>
  );
}
