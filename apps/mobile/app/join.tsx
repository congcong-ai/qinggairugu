import { useEffect, useState } from 'react';
import { Image, Text } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Page, Heading, Card, Action, styles } from '../src/ui';
import { shareSession, syncParticipants } from '../src/cloud';
import type { Profile } from '@pengtou/contracts';
export default function Join() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [qr, setQr] = useState<Awaited<ReturnType<typeof shareSession>> | null>(
    null,
  );
  const [people, setPeople] = useState<{ id: string; profile: Profile }[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    let live = true;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const result = await syncParticipants(id);
        if (live) {
          setPeople(result.people);
          setError('');
        }
      } catch {
        if (live) setError('人数更新失败，会自动重试。');
      } finally {
        if (live) timer = setTimeout(() => void poll(), 5000);
      }
    };
    void shareSession(id)
      .then((result) => {
        if (live) {
          setQr(result);
          void poll();
        }
      })
      .catch(() => {
        if (live) setError('加入码生成失败，请检查服务配置后重新打开。');
      });
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [id]);
  return (
    <Page>
      <Heading title="让大家加入" subtitle="见过的人，也值得留下来。" />
      <Card>
        {qr ? (
          <>
            <Image
              source={{ uri: qr.imageDataUrl }}
              style={{ width: 260, height: 260, alignSelf: 'center' }}
            />
            <Text style={styles.caption}>
              {qr.mode === 'debug'
                ? '开发调试码：尚未配置微信 AppID，不能直接唤起小程序。请在开发者工具用下面的 sid 打开本场。'
                : '微信扫一扫，加入这场'}
            </Text>
            {qr.mode === 'debug' && (
              <Text selectable style={styles.caption}>
                {id}
              </Text>
            )}
          </>
        ) : (
          <Text style={styles.body}>正在准备加入码…</Text>
        )}
        <Text style={styles.label}>已有 {people.length} 人加入</Text>
        {error && <Text style={styles.caption}>{error}</Text>}
      </Card>
      {people.map((person) => (
        <Card key={person.id}>
          <Text style={styles.label}>{person.profile.name}</Text>
          <Text style={styles.body}>{person.profile.introduction}</Text>
        </Card>
      ))}
      <Action
        label="记录这次见面"
        onPress={() =>
          router.push({ pathname: '/recording', params: { sid: id } })
        }
      />
      <Action
        secondary
        label="刷新人数"
        onPress={() =>
          void syncParticipants(id)
            .then((r) => {
              setPeople(r.people);
              setError('');
            })
            .catch(() => setError('刷新失败，请稍后重试'))
        }
      />
    </Page>
  );
}
