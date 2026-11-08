import { useEffect, useState } from 'react';
import { Image, Text, useWindowDimensions } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Page, Heading, Card, Action, styles } from '../src/ui';
import { shareSession, syncParticipants } from '../src/cloud';
import type { Profile } from '@qinggairugu/contracts';
export default function Join() {
  const { width } = useWindowDimensions();
  const qrSize = Math.max(180, Math.min(260, width - 96));
  const { id } = useLocalSearchParams<{ id: string }>();
  const [qr, setQr] = useState<Awaited<ReturnType<typeof shareSession>> | null>(
    null,
  );
  const [people, setPeople] = useState<{ id: string; profile: Profile }[]>([]);
  const [error, setError] = useState('');
  const [qrError, setQrError] = useState('');
  const [qrRetry, setQrRetry] = useState(0);
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
          setQrError('');
          void poll();
        }
      })
      .catch(() => {
        if (live) setQrError('加入码生成失败，请检查网络后重试。');
      });
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [id, qrRetry]);
  return (
    <Page>
      <Heading
        title="让大家加入"
        subtitle="我是发起人 · 请大家用微信扫码加入"
      />
      <Card>
        {qr ? (
          <>
            <Image
              source={{ uri: qr.imageDataUrl }}
              style={{ width: qrSize, height: qrSize, alignSelf: 'center' }}
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
          <Text style={styles.body}>{qrError || '正在准备加入码…'}</Text>
        )}
        {!!qrError && (
          <Action
            secondary
            label="重试生成加入码"
            onPress={() => setQrRetry((value) => value + 1)}
          />
        )}
        <Text style={styles.label}>
          {people.length ? `已有 ${people.length} 人加入` : '还没有人加入'}
        </Text>
        {error && (
          <Text accessibilityRole="alert" style={styles.error}>
            {error}
          </Text>
        )}
      </Card>
      {people.map((person) => (
        <Card key={person.id}>
          <Text style={styles.label}>{person.profile.name}</Text>
          <Text style={styles.body}>{person.profile.introduction}</Text>
        </Card>
      ))}
      <Action
        label="开始记录这次见面"
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
