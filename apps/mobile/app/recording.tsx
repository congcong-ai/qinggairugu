import { StarterCode } from '../src/starter-code';
import { shareSession } from '../src/cloud';
import { LocalMediaNotice } from '../src/local-media-notice';
import { useEffect, useRef, useState } from 'react';
import { Text, View, Image } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Page, Heading, Card, Action, styles } from '../src/ui';
import { useRecording } from '../src/recording-context';
import { formatDuration } from '@pengtou/shared';
import { colors } from '@pengtou/design-tokens';
export default function Recording() {
  const recording = useRecording();
  const started = useRef(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  const { sid, role } = useLocalSearchParams<{ sid?: string; role?: string }>();
  const [qr, setQr] = useState('');
  const [qrError, setQrError] = useState('');
  const sessionId = recording.active?.sessionId;
  useEffect(() => {
    if (role !== 'organizer' || !sessionId) return;
    let live = true;
    void shareSession(sessionId)
      .then((r) => {
        if (live) setQr(r.imageDataUrl);
      })
      .catch(() => {
        if (live) setQrError('加入码暂不可用，录音会继续保存在本机。');
      });
    return () => {
      live = false;
    };
  }, [role, sessionId]);
  useEffect(() => {
    if (!started.current) {
      started.current = true;
      void recording.start(sid);
    }
  }, [recording, sid]);
  return (
    <Page>
      <Heading
        title="留住这次见面"
        subtitle={recording.active?.title ?? '无需起名，先好好聊聊。'}
      />
      {role && (
        <Text style={styles.caption}>
          {role === 'organizer' ? '我是发起人' : '我是参与者 · 私人记录'}
        </Text>
      )}
      <Card>
        <Text style={styles.caption}>请确保现场人员知道并同意录音。</Text>
        <Text
          style={{
            fontSize: 60,
            color: colors.ink,
            fontVariant: ['tabular-nums'],
            textAlign: 'center',
            paddingVertical: 24,
          }}
        >
          {formatDuration(recording.duration)}
        </Text>
        <View
          accessibilityLabel="麦克风音量"
          style={{
            height: 72,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 5,
          }}
        >
          {Array.from({ length: 23 }, (_, i) => (
            <View
              key={i}
              style={{
                width: 5,
                borderRadius: 4,
                backgroundColor: colors.primary,
                height:
                  recording.status === 'recording'
                    ? Math.max(
                        5,
                        (60 + recording.metering) *
                          (0.4 + 0.6 * Math.sin(i * 0.7) ** 2),
                      )
                    : 5,
              }}
            />
          ))}
        </View>
        <Text style={[styles.body, { textAlign: 'center' }]}>
          {
            {
              idle: '准备记录',
              recording: '正在记录',
              paused: '已暂停',
              interrupted: '录音中断',
            }[recording.status]
          }
        </Text>
      </Card>
      {recording.error && (
        <Text
          accessibilityRole="alert"
          style={{ color: colors.danger, lineHeight: 24 }}
        >
          {recording.error}
        </Text>
      )}
      {!recording.active ? (
        <Action
          label="开始记录"
          disabled={recording.busy}
          onPress={() => void recording.start(sid)}
        />
      ) : (
        <>
          <Action
            label={recording.status === 'paused' ? '继续记录' : '暂停一下'}
            disabled={recording.busy || recording.status === 'interrupted'}
            onPress={() =>
              void (recording.status === 'paused'
                ? recording.resume()
                : recording.pause())
            }
          />
          <Action
            secondary
            label="完成并保存"
            disabled={recording.busy}
            onPress={() => {
              setSavedId(recording.active?.sessionId ?? null);
              void recording.finish();
            }}
          />
        </>
      )}
      {!recording.active && savedId && (
        <Action
          label="查看保存的记录"
          onPress={() =>
            router.replace({
              pathname: '/session/[id]',
              params: { id: savedId },
            })
          }
        />
      )}
      {recording.active && role === 'organizer' && (
        <Card>
          <Text style={styles.label}>邀请大家加入</Text>
          {qr ? (
            <Image
              source={{ uri: qr }}
              style={{ width: 200, height: 200, alignSelf: 'center' }}
            />
          ) : (
            <Text style={styles.caption}>{qrError || '正在加载加入码…'}</Text>
          )}
          <Text style={styles.caption}>需要邀请时，请大家用微信扫一扫。</Text>
        </Card>
      )}
      {recording.active && role === 'participant' && (
        <Text style={styles.caption}>
          这是你的私人记录。需要关联主办方活动时，可在保存后的本场设置中操作。
        </Text>
      )}
      {recording.active && role === 'participant' && (
        <StarterCode title={recording.active.title} />
      )}
      <LocalMediaNotice />
      <Action secondary label="返回首页" onPress={() => router.replace('/')} />
    </Page>
  );
}
