import { useCallback, useState } from 'react';
import { useFocusEffect, router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { colors } from '@qinggairugu/design-tokens';
import { listSessions, type LocalSession } from '../../src/storage/database';
import { Page, Heading, Card, Action, styles } from '../../src/ui';

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('zh-CN', {
    month: 'long',
    day: 'numeric',
  });
}

export default function Home() {
  const [recent, setRecent] = useState<LocalSession[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  useFocusEffect(
    useCallback(() => {
      let live = true;
      setLoading(true);
      void listSessions()
        .then((rows) => {
          if (!live) return;
          setRecent(rows.slice(0, 3));
          setError('');
        })
        .catch(() => {
          if (live) setError('暂时无法读取本机记录，请稍后重试。');
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
      <Heading title="倾盖如故" subtitle="把每一次见面留下来。" />

      <View style={styles.homeHero}>
        <View style={styles.homeHeroCopy}>
          <Text style={styles.homeEyebrow}>从一段真实的相遇开始</Text>
          <Text style={styles.homeHeroTitle}>先好好聊，记录交给我。</Text>
          <Text style={styles.homeHeroBody}>
            不用先起名字。录音会保存在这台手机，想整理时再配置百炼。
          </Text>
        </View>
        <Action
          label="开始记录"
          accessibilityHint="开始一段保存在本机的录音"
          onPress={() =>
            router.push({
              pathname: '/recording',
              params: { role: 'organizer' },
            })
          }
        />
      </View>

      <View style={styles.homeQuickActions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="只记录自己的见闻"
          onPress={() =>
            router.push({
              pathname: '/recording',
              params: { role: 'participant' },
            })
          }
          style={({ pressed }) => [
            styles.quickAction,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.quickActionTitle}>只记录自己的见闻</Text>
          <Text style={styles.quickActionDetail}>内容只保存在本机</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="提前创建一场活动"
          onPress={() => router.push('/create')}
          style={({ pressed }) => [
            styles.quickAction,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.quickActionTitle}>提前创建一场</Text>
          <Text style={styles.quickActionDetail}>填写名称和参与者可见范围</Text>
        </Pressable>
      </View>

      <View style={styles.sectionHeading}>
        <View style={styles.sectionHeadingCopy}>
          <Heading
            title="最近记录"
            subtitle="只有保存在这台设备的记录会显示在这里。"
          />
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="查看全部记录"
          onPress={() => router.push('/records')}
          hitSlop={8}
          style={({ pressed }) => [styles.textLink, pressed && styles.pressed]}
        >
          <Text style={{ color: colors.primary, fontWeight: '600' }}>全部</Text>
        </Pressable>
      </View>

      {loading && <Text style={styles.caption}>正在打开本机记录…</Text>}
      {!!error && (
        <Card>
          <Text accessibilityRole="alert" style={styles.body}>
            {error}
          </Text>
          <Action
            secondary
            label="到我的活动重试"
            onPress={() => router.push('/records')}
          />
        </Card>
      )}
      {!loading && !error && recent.length === 0 && (
        <Card>
          <Text style={styles.label}>下一次见面，从这里开始</Text>
          <Text style={styles.body}>
            结束录音后，记录会留在本机。你可以随时回来继续听、整理或回顾。
          </Text>
          <Action
            secondary
            label="先看看一份离线示例"
            onPress={() => router.push('/example')}
          />
        </Card>
      )}
      {recent.map((session) => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`打开${session.title}，${formatDate(session.created_at)}，保存在本机`}
          key={session.id}
          onPress={() =>
            router.push({
              pathname: '/session/[id]',
              params: { id: session.id },
            })
          }
          style={({ pressed }) => [
            styles.recentCard,
            pressed && styles.pressed,
          ]}
        >
          <View style={styles.recentMark} />
          <View style={styles.recentCopy}>
            <Text numberOfLines={2} style={styles.recentTitle}>
              {session.title}
            </Text>
            <Text style={styles.caption}>
              {formatDate(session.created_at)} · 本机记录
            </Text>
          </View>
          <Text style={styles.recentChevron}>›</Text>
        </Pressable>
      ))}
      {!loading && recent.length > 0 && (
        <Card style={styles.exampleCard}>
          <Text style={styles.label}>想先看看整理后的样子？</Text>
          <Action
            secondary
            label="浏览一份离线示例"
            onPress={() => router.push('/example')}
          />
        </Card>
      )}
    </Page>
  );
}
