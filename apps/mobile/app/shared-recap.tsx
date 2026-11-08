import { useCallback, useState } from 'react';
import { Text } from 'react-native';
import { useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Page, Heading, Card, Action, styles } from '../src/ui';
import { cloudRequest, cloudSessionId } from '../src/cloud';
export default function SharedRecap() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [content, setContent] = useState<string | null>(null);
  const [status, setStatus] = useState('正在获取本场已发布回顾…');
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  useFocusEffect(
    useCallback(() => {
      let live = true;
      setError(false);
      setContent(null);
      setStatus('正在获取本场已发布回顾…');
      void cloudSessionId(id)
        .then((sid) =>
          cloudRequest<{ recap: { content: string } | null }>(
            `/sessions/${sid}/recap`,
          ),
        )
        .then((result) => {
          if (!live) return;
          setContent(result.recap?.content ?? null);
          setStatus(
            result.recap ? '' : '这场还没有已发布的回顾，或回顾已撤回。',
          );
        })
        .catch((error) => {
          if (live) {
            setError(true);
            setStatus(
              error instanceof Error ? error.message : '暂时无法获取本场回顾',
            );
          }
        });
      return () => {
        live = false;
      };
    }, [id, retry]),
  );
  return (
    <Page>
      <Heading title="这场回顾" subtitle="本场共享 · 由创建者审核发布" />
      {content !== null && (
        <Card>
          <Text selectable style={styles.body}>
            {content}
          </Text>
        </Card>
      )}
      {!!status && (
        <Text
          accessibilityRole={error ? 'alert' : undefined}
          style={error ? styles.error : styles.caption}
        >
          {status}
        </Text>
      )}
      {error && (
        <Action
          secondary
          label="重试获取回顾"
          onPress={() => setRetry((value) => value + 1)}
        />
      )}
      <Text style={styles.caption}>
        这里仅显示已发布的共享文字，不包含其他人的私人心得、录音或整理结果。
      </Text>
    </Page>
  );
}
