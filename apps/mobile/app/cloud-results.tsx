import { useCallback, useState } from 'react';
import { Text } from 'react-native';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Page, Heading, Card, Action, styles } from '../src/ui';
import { cloudRequest } from '../src/cloud';
import type { PrivateAIInput } from '@qinggairugu/contracts';
export default function Results() {
  const { activityId } = useLocalSearchParams<{ activityId: string }>();
  const [items, setItems] = useState<(PrivateAIInput & { id: string })[]>([]);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  useFocusEffect(
    useCallback(() => {
      let live = true;
      setItems([]);
      setStatus('正在核对本人权限…');
      setLoading(true);
      void cloudRequest<(PrivateAIInput & { id: string })[]>('/me/private-ai')
        .then((rows) => {
          if (live) {
            setStatus('');
            setItems(
              rows.filter(
                (r) =>
                  r.localSessionId === activityId || r.sessionId === activityId,
              ),
            );
          }
        })
        .catch((e) => {
          if (live) setStatus(e.message);
        })
        .finally(() => {
          if (live) setLoading(false);
        });
      return () => {
        live = false;
        setItems([]);
      };
    }, [activityId]),
  );
  return (
    <Page>
      <Heading
        title="我的整理结果"
        subtitle="只有我可见 · 其他设备主动同步的文字"
      />
      {loading && <Text style={styles.caption}>正在确认访问权限…</Text>}
      {!loading && !!status && (
        <Card>
          <Text accessibilityRole="alert" style={styles.error}>
            {status}
          </Text>
          <Action
            secondary
            label="重新关联小程序"
            onPress={() => router.push('/binding')}
          />
        </Card>
      )}
      {items.map((r) => (
        <Card key={r.id}>
          <Text style={styles.label}>{r.title}</Text>
          <Text style={styles.body}>{r.content.summary}</Text>
          {r.content.topics?.map((v, i) => (
            <Text key={i} style={styles.body}>
              话题 · {v}
            </Text>
          ))}
          {r.content.actions?.map((v, i) => (
            <Text key={i} style={styles.body}>
              行动 · {v}
            </Text>
          ))}
          {r.content.transcript?.map((v) => (
            <Text key={v.id} style={styles.body}>
              {v.text}
            </Text>
          ))}
        </Card>
      ))}
      {!loading && !status && !items.length && (
        <Card>
          <Text style={styles.label}>还没有同步的整理结果</Text>
          <Text style={styles.body}>
            你可以在本机整理页面选择要同步的文字。录音和搜索索引不会上传。
          </Text>
          <Action
            secondary
            label="关联我的小程序"
            onPress={() => router.push('/binding')}
          />
        </Card>
      )}
      {!loading && !status && items.length > 0 && (
        <Text style={styles.caption}>录音及本地搜索索引未同步。</Text>
      )}
    </Page>
  );
}
