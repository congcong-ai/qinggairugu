import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { listSessions, type LocalSession } from '../../src/storage/database';
import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { Page, Heading, Card, Action, styles } from '../../src/ui';
import { colors } from '@pengtou/design-tokens';
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
      <Heading title="倾盖如故" subtitle="每次相聚，都算数" />
      <View
        style={{
          backgroundColor: colors.soft,
          borderRadius: 32,
          padding: 28,
          gap: 22,
        }}
      >
        <Text style={{ fontSize: 13, color: colors.primary, letterSpacing: 3 }}>
          见面，是故事的开始
        </Text>
        <Text
          style={{
            fontSize: 30,
            lineHeight: 44,
            fontWeight: '600',
            color: colors.ink,
          }}
        >
          好好聊聊，{'\n'}剩下的交给倾盖如故。
        </Text>
        <Text style={styles.body}>
          从一杯咖啡到一场分享，{'\n'}留住那些值得记住的声音。
        </Text>
        <Action label="开始录音" onPress={() => router.push('/recording')} />
        <Text style={styles.caption}>无需注册 · 录音保存在你的设备</Text>
      </View>
      <Action
        secondary
        label="记一次活动"
        onPress={() => router.push('/entry')}
      />
      <Action
        secondary
        label="问倾盖如故"
        onPress={() => router.push('/search')}
      />
      <Action
        secondary
        label="发起活动"
        onPress={() => router.push('/create')}
      />
      <Heading title="最近" />
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
