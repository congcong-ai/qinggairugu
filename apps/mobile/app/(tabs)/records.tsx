import { useCallback, useState } from 'react';
import { Text } from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import { Page, Heading, Card, Action, styles } from '../../src/ui';
import { listSessions, type LocalSession } from '../../src/storage/database';
import { formatDuration } from '@pengtou/shared';
export default function Records() {
  const [sessions, setSessions] = useState<LocalSession[]>([]);
  const [error, setError] = useState(false);
  useFocusEffect(
    useCallback(() => {
      let live = true;
      void listSessions()
        .then((rows) => {
          if (live) {
            setSessions(rows);
            setError(false);
          }
        })
        .catch(() => {
          if (live) setError(true);
        });
      return () => {
        live = false;
      };
    }, []),
  );
  return (
    <Page>
      <Heading title="记录" subtitle="每一次见面，都有迹可循。" />
      {error && (
        <Text style={styles.body}>
          暂时无法读取本地记录，请重新打开此页重试。
        </Text>
      )}
      {sessions.length === 0 && !error ? (
        <Card>
          <Text style={styles.body}>
            你还没有保存记录。开始一次记录，让值得记住的对话留下来。
          </Text>
          <Action label="开始记录" onPress={() => router.push('/recording')} />
        </Card>
      ) : (
        sessions.map((item) => (
          <Card key={item.id}>
            <Text style={styles.label}>{item.title}</Text>
            <Text style={styles.body}>
              {formatDuration(item.duration_ms)} ·{' '}
              {
                (
                  {
                    recording: '记录中',
                    paused: '已暂停',
                    completed: '已保存',
                    interrupted: '中断记录 · 待检查',
                    ready: '准备中',
                  } as Record<string, string>
                )[item.state]
              }
            </Text>
            <Action
              secondary
              label="打开记录"
              onPress={() =>
                router.push({
                  pathname: '/session/[id]',
                  params: { id: item.id },
                })
              }
            />
          </Card>
        ))
      )}
    </Page>
  );
}
