import { useCallback, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import { activityTimeline } from '../../src/activity-timeline';
import { Page, Heading, Card, Action, styles } from '../../src/ui';
import { listSessions, type LocalSession } from '../../src/storage/database';
import { refreshActivities, openCloudActivity } from '../../src/cloud';
import type { ActivityItem } from '@qinggairugu/contracts';

export default function Records() {
  const [local, setLocal] = useState<LocalSession[]>([]);
  const [cloud, setCloud] = useState<ActivityItem[]>([]);
  const [localError, setLocalError] = useState('');
  const [cloudError, setCloudError] = useState('');
  const [loadingLocal, setLoadingLocal] = useState(true);
  const [loadingCloud, setLoadingCloud] = useState(true);
  const localRequest = useRef(0);
  const cloudRequest = useRef(0);

  const loadLocal = useCallback(async () => {
    const request = ++localRequest.current;
    setLoadingLocal(true);
    try {
      const rows = await listSessions();
      if (request !== localRequest.current) return;
      setLocal(rows);
      setLocalError('');
    } catch {
      if (request !== localRequest.current) return;
      setLocalError('本机记录暂时无法读取，请重试。');
    } finally {
      if (request === localRequest.current) setLoadingLocal(false);
    }
  }, []);
  const loadCloud = useCallback(async () => {
    const request = ++cloudRequest.current;
    setLoadingCloud(true);
    try {
      const rows = await refreshActivities();
      if (request !== cloudRequest.current) return;
      setCloud(rows);
      setCloudError('');
    } catch {
      if (request !== cloudRequest.current) return;
      setCloudError('云端活动暂不可用；本机记录仍可打开。');
    } finally {
      if (request === cloudRequest.current) setLoadingCloud(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadLocal();
      void loadCloud();
      return () => {
        localRequest.current++;
        cloudRequest.current++;
      };
    }, [loadCloud, loadLocal]),
  );

  const cards = activityTimeline(local, cloud);
  return (
    <Page>
      <Heading
        title="我的活动"
        subtitle="我发起的、我参加的，以及只保存在本机的记录。"
      />
      <Action
        label="开始记录"
        onPress={() =>
          router.push({ pathname: '/recording', params: { role: 'organizer' } })
        }
      />
      <View style={styles.inlineActions}>
        <Action
          secondary
          label="提前创建或加入"
          onPress={() => router.push('/start')}
        />
        <Action
          secondary
          label="搜索本机记录"
          onPress={() => router.push('/search')}
        />
      </View>

      {(loadingLocal || loadingCloud) && (
        <Text style={styles.caption}>
          {loadingLocal ? '正在读取本机记录' : ''}
          {loadingLocal && loadingCloud ? ' · ' : ''}
          {loadingCloud ? '正在检查云端活动…' : ''}
        </Text>
      )}
      {!!localError && (
        <Card>
          <Text accessibilityRole="alert" style={styles.body}>
            {localError}
          </Text>
          <Action
            secondary
            label="重试读取本机记录"
            onPress={() => void loadLocal()}
          />
        </Card>
      )}
      {!!cloudError && (
        <Card>
          <Text style={styles.caption}>{cloudError}</Text>
          <Action
            secondary
            label="重试检查云端"
            onPress={() => void loadCloud()}
          />
        </Card>
      )}

      {!loadingLocal && !loadingCloud && !cards.length && !localError && (
        <Card>
          <Text style={styles.label}>
            {cloudError ? '先从一段本机记录开始' : '还没有活动记录'}
          </Text>
          <Text style={styles.body}>
            结束录音后，这里会显示你保存在本机的记录。登录和联网不是开始录音的前提。
          </Text>
          <Action
            label="现在开始记录"
            onPress={() =>
              router.push({
                pathname: '/recording',
                params: { role: 'organizer' },
              })
            }
          />
        </Card>
      )}

      {cards.map((item) => (
        <Card key={item.id}>
          <Text style={styles.label}>{item.title}</Text>
          <Text style={styles.caption}>
            {new Date(item.occurredAt).toLocaleDateString('zh-CN', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
            {' · '}
            {
              {
                organizer: '我发起的',
                participant: '我参加的',
                private: '本机私人记录',
              }[item.relation]
            }
            {item.localRecords.length
              ? ` · 本机 ${item.localRecords.length} 份记录`
              : ''}
          </Text>
          {item.localRecords.length === 1 && (
            <Action
              secondary
              label="打开本机记录"
              onPress={() =>
                router.push({
                  pathname: '/session/[id]',
                  params: { id: item.localRecords[0]!.id },
                })
              }
            />
          )}
          {item.localRecords.length > 1 && (
            <View style={styles.recordChoices}>
              <Text style={styles.caption}>选择要打开的本机记录</Text>
              {item.localRecords.map((record) => (
                <Action
                  key={record.id}
                  secondary
                  label={record.title}
                  onPress={() =>
                    router.push({
                      pathname: '/session/[id]',
                      params: { id: record.id },
                    })
                  }
                />
              ))}
            </View>
          )}
          {!item.localRecords.length && item.sessionId && (
            <Action
              secondary
              label="打开活动"
              onPress={() =>
                void openCloudActivity(item.sessionId!)
                  .then((id) =>
                    router.push({ pathname: '/session/[id]', params: { id } }),
                  )
                  .catch(() =>
                    setCloudError('活动暂时无法打开，请检查网络后重试。'),
                  )
              }
            />
          )}
          {!item.localRecords.length && !item.sessionId && item.entryIds[0] && (
            <Action
              secondary
              label="打开我的心得"
              accessibilityHint="仅本人可以查看这份云端心得"
              onPress={() =>
                router.push({
                  pathname: '/entry',
                  params: { cloudEntryId: item.entryIds[0] },
                })
              }
            />
          )}
          {cloud.some((activity) => activity.id === item.id) &&
            (item.sessionId || item.localRecords.length > 0) && (
              <Action
                secondary
                label="查看我同步的整理文字"
                accessibilityHint="只有本人可见，不会发布给本场参与者"
                onPress={() =>
                  router.push({
                    pathname: '/cloud-results',
                    params: { activityId: item.sessionId ?? item.id },
                  })
                }
              />
            )}
          {item.entryIds.map((entryId) => (
            <Action
              key={entryId}
              secondary
              label="查看我的心得"
              accessibilityHint="仅本人可以查看"
              onPress={() =>
                router.push({
                  pathname: '/entry',
                  params: { cloudEntryId: entryId },
                })
              }
            />
          ))}
        </Card>
      ))}
    </Page>
  );
}
