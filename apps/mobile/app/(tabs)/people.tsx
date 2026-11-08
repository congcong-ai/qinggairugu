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
  const load = useCallback(async () => {
    setLoading(true);
    try {
      setGroups(await listSessionPeople());
      setError('');
    } catch {
      setError('暂时无法读取本机参与者，请稍后重试。');
    } finally {
      setLoading(false);
    }
  }, []);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const total = groups.reduce((count, group) => count + group.people.length, 0);
  return (
    <Page>
      <Heading title="见过的人" subtitle="从一次见面，慢慢认识。" />
      <Text style={styles.caption}>
        这里只显示本机记录中已同步到的本场参与者，不会搜索全平台用户。
      </Text>
      {loading && <Text style={styles.caption}>正在找回见过的人…</Text>}
      {!!error && (
        <Card>
          <Text accessibilityRole="alert" style={styles.body}>
            {error}
          </Text>
          <Action secondary label="重试" onPress={() => void load()} />
        </Card>
      )}
      {!loading && !error && !groups.length && (
        <Card>
          <Text style={styles.label}>下一次见面，认识一下</Text>
          <Text style={styles.body}>
            记录时生成加入码并邀请大家填写介绍。参与者资料会按本场的可见范围显示。
          </Text>
          <Action
            label="开始记录"
            onPress={() =>
              router.push({
                pathname: '/recording',
                params: { role: 'organizer' },
              })
            }
          />
          <Action
            secondary
            label="查看我的活动"
            onPress={() => router.push('/records')}
          />
        </Card>
      )}
      {!loading && !error && groups.length > 0 && (
        <View style={styles.peopleSummary}>
          <Text style={styles.peopleSummaryNumber}>{total}</Text>
          <Text style={styles.caption}>
            份参与者介绍 · 分布在 {groups.length} 次见面
          </Text>
        </View>
      )}
      {groups.map((group) => (
        <Card key={group.sessionId}>
          <Text style={styles.label}>{group.sessionTitle}</Text>
          <Text style={styles.caption}>
            {new Date(group.createdAt).toLocaleDateString('zh-CN', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
            {' · '}
            {group.people.length} 人
          </Text>
          {group.people.map((person) => (
            <View key={person.id} style={styles.personRow}>
              <View style={styles.personAvatar} accessible={false}>
                <Text style={styles.personAvatarText}>
                  {person.name.trim().slice(0, 1) || '友'}
                </Text>
              </View>
              <View style={styles.personCopy}>
                <Text style={styles.personName}>{person.name}</Text>
                <Text style={styles.body}>{person.introduction}</Text>
              </View>
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
