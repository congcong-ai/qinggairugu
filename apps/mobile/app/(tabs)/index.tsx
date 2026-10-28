import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { listSessions, type LocalSession } from '../../src/storage/database';
import { Text } from 'react-native';
import { router } from 'expo-router';
import { Page, Heading, Card, Action, styles } from '../../src/ui';
export default function Home() {
  const [recent, setRecent] = useState<LocalSession[]>([]);
  const [error, setError] = useState('');
  useFocusEffect(
    useCallback(() => {
      let live = true;
      void listSessions()
        .then((rows) => {
          if (live) {
            setRecent(rows.slice(0, 3));
            setError('');
          }
        })
        .catch(() => {
          if (live) setError('暂时无法读取本机记录');
        });
      return () => {
        live = false;
      };
    }, []),
  );
  return (
    <Page>
      <Heading title="倾盖如故" subtitle="把每一次见面留下来。" />
      <Action label="记录一场活动" onPress={() => router.push('/start')} />
      <Heading title="最近记录" />
      {error && <Text style={styles.body}>{error}</Text>}
      {recent.map((session) => (
        <Card key={session.id}>
          <Text style={styles.label}>{session.title}</Text>
          <Text style={styles.caption}>
            {new Date(session.created_at).toLocaleDateString('zh-CN')} ·
            保存在本机
          </Text>
          <Action
            secondary
            label="找回这次交谈"
            onPress={() =>
              router.push({
                pathname: '/session/[id]',
                params: { id: session.id },
              })
            }
          />
        </Card>
      ))}
      {!recent.length && (
        <Card>
          <Text style={styles.label}>下一次见面，从这里开始</Text>
          <Text style={styles.body}>
            记录完成后，你可以在这里找回这次交谈。
          </Text>
          <Action
            secondary
            label="查看我的记录"
            onPress={() => router.push('/records')}
          />
        </Card>
      )}
    </Page>
  );
}
