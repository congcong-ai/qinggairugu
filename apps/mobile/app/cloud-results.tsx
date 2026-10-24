import { useCallback, useState } from 'react';
import { Text } from 'react-native';
import { useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Page, Heading, Card, styles } from '../src/ui';
import { cloudRequest } from '../src/cloud';
import type { PrivateAIInput } from '@pengtou/contracts';
export default function Results() {
  const { activityId } = useLocalSearchParams<{ activityId: string }>();
  const [items, setItems] = useState<(PrivateAIInput & { id: string })[]>([]);
  const [status, setStatus] = useState('');
  useFocusEffect(
    useCallback(() => {
      let live = true;
      setItems([]);
      setStatus('正在核对本人权限…');
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
      <Text style={styles.caption}>
        {status ||
          (!items.length
            ? '尚未同步，音频仍在原设备中。'
            : '音频及搜索索引未同步。')}
      </Text>
    </Page>
  );
}
