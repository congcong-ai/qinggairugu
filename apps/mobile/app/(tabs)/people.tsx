import { useCallback, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { Text, View } from 'react-native';
import { Page, Heading, Card, Action, styles } from '../../src/ui';
import {
  listSessionPeople,
  type SessionPeople,
} from '../../src/storage/database';
export default function People() {
  const [groups, setGroups] = useState<SessionPeople[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  useFocusEffect(
    useCallback(() => {
      let live = true;
      void listSessionPeople()
        .then((rows) => {
          if (live) {
            setGroups(rows);
            setError('');
          }
        })
        .catch(() => {
          if (live) setError('暂时无法读取本机参与者，请稍后重试');
        })
        .finally(() => {
          if (live) setLoading(false);
        });
      return () => {
        live = false;
      };
    }, []),
  );
  return (
    <Page>
      <Heading title="人" subtitle="从一次见面，慢慢认识。" />
      <Text style={styles.caption}>
        这里留着本机记录中已同步的参与者，按每次见面展示。
      </Text>
      {error && <Text style={styles.body}>{error}</Text>}
      {loading && <Text style={styles.body}>正在找回见过的人…</Text>}
      {!loading && !error && !groups.length && (
        <Card>
          <Text style={styles.label}>下一次见面，认识一下</Text>
          <Text style={styles.body}>
            记录时点「让大家加入」，这场参与者的介绍就会留在对应记录里。
          </Text>
          <Action
            secondary
            label="查看我的记录"
            onPress={() => router.push('/records')}
          />
        </Card>
      )}
      {groups.map((group) => (
        <Card key={group.sessionId}>
          <Text style={styles.label}>{group.sessionTitle}</Text>
          <Text style={styles.caption}>
            {new Date(group.createdAt).toLocaleDateString('zh-CN')} ·{' '}
            {group.people.length} 人
          </Text>
          {group.people.map((person) => (
            <View key={person.id} style={{ gap: 6, paddingVertical: 8 }}>
              <Text style={styles.label}>{person.name}</Text>
              <Text style={styles.body}>{person.introduction}</Text>
            </View>
          ))}
          <Action
            secondary
            label="回到这次见面"
            onPress={() =>
              router.push({
                pathname: '/session/[id]',
                params: { id: group.sessionId },
              })
            }
          />
        </Card>
      ))}
    </Page>
  );
}
