import { useEffect, useState } from 'react';
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Page, Heading, Card, Action, styles } from '../src/ui';
import { shareSession, syncParticipants } from '../src/cloud';
import type { Profile } from '@qinggairugu/contracts';
import { colors } from '@qinggairugu/design-tokens';
type JoinedPerson = { id: string; profile: Profile };
const profileFields: [keyof Profile, string][] = [
  ['introduction', '一句话介绍'],
  ['workingOn', '最近在搞什么'],
  ['wantToDiscuss', '今天想聊什么'],
  ['wantToMeet', '想认识什么样的人'],
  ['canDiscuss', '可以找我聊什么'],
  ['organization', '公司 / 组织'],
  ['occupation', '职业'],
  ['city', '城市'],
  ['publicLink', '公开账号链接'],
];
export default function Join() {
  const { width } = useWindowDimensions();
  const qrSize = Math.max(180, Math.min(260, width - 96));
  const { id } = useLocalSearchParams<{ id: string }>();
  const [qr, setQr] = useState<Awaited<ReturnType<typeof shareSession>> | null>(
    null,
  );
  const [people, setPeople] = useState<JoinedPerson[]>([]);
  const [selectedPerson, setSelectedPerson] = useState<JoinedPerson | null>(
    null,
  );
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
        <Text style={styles.caption}>
          本场参与者可以互相查看「关于我」；点开下方的人可以看完整介绍。
        </Text>
        {error && (
          <Text accessibilityRole="alert" style={styles.error}>
            {error}
          </Text>
        )}
      </Card>
      {people.map((person) => (
        <Pressable
          key={person.id}
          accessibilityRole="button"
          accessibilityLabel={`查看${person.profile.name}的介绍`}
          accessibilityHint="打开本场参与者填写的关于我"
          onPress={() => setSelectedPerson(person)}
          style={({ pressed }) => ({ opacity: pressed ? 0.78 : 1 })}
        >
          <Card>
            <Text style={styles.label}>{person.profile.name}</Text>
            <Text style={styles.body}>{person.profile.introduction}</Text>
            <Text style={styles.caption}>查看完整介绍 ›</Text>
          </Card>
        </Pressable>
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
      <Modal
        visible={selectedPerson !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedPerson(null)}
      >
        <View
          style={{
            flex: 1,
            justifyContent: 'flex-end',
            backgroundColor: 'rgba(28, 35, 29, 0.42)',
          }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="关闭参与者介绍"
            onPress={() => setSelectedPerson(null)}
            style={{ flex: 1 }}
          />
          <View
            style={{
              maxHeight: '82%',
              paddingTop: 20,
              paddingHorizontal: 20,
              paddingBottom: 18,
              gap: 12,
              borderTopLeftRadius: 26,
              borderTopRightRadius: 26,
              backgroundColor: colors.background,
            }}
          >
            <Text accessibilityRole="header" style={styles.title}>
              {selectedPerson?.profile.name ?? '参与者介绍'}
            </Text>
            <ScrollView contentContainerStyle={{ gap: 14, paddingBottom: 8 }}>
              {profileFields.map(([key, label]) => {
                const value = selectedPerson?.profile[key];
                if (typeof value !== 'string' || !value.trim()) return null;
                return (
                  <View key={key} style={{ gap: 4 }}>
                    <Text style={styles.caption}>{label}</Text>
                    <Text selectable style={styles.body}>
                      {value}
                    </Text>
                  </View>
                );
              })}
            </ScrollView>
            <Action
              secondary
              label="关闭"
              onPress={() => setSelectedPerson(null)}
            />
          </View>
        </View>
      </Modal>
    </Page>
  );
}
