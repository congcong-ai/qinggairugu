import { StarterCode } from '../src/starter-code';
import { shareSession } from '../src/cloud';
import { LocalMediaNotice } from '../src/local-media-notice';
import { useEffect, useRef, useState } from 'react';
import { Alert, BackHandler, Text, View, Image } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Page, Heading, Card, Action, styles } from '../src/ui';
import { useRecording } from '../src/recording-context';
import { formatDuration } from '@qinggairugu/shared';
import { colors } from '@qinggairugu/design-tokens';
export default function Recording() {
  const recording = useRecording();
  const started = useRef(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const { sid, role } = useLocalSearchParams<{ sid?: string; role?: string }>();
  const [qr, setQr] = useState('');
  const [qrError, setQrError] = useState('');
  const sessionId = recording.active?.sessionId;
  async function createJoinCode() {
    if (!sessionId || sharing) return;
    setSharing(true);
    setQrError('');
    try {
      const result = await shareSession(sessionId);
      setQr(result.imageDataUrl);
    } catch {
      setQrError('加入码暂不可用。录音仍保存在本机，请检查网络后重试。');
    } finally {
      setSharing(false);
    }
  }
  useEffect(() => {
    if (!started.current) {
      started.current = true;
      void recording.start(sid);
    }
  }, [recording, sid]);
  useEffect(() => {
    if (!recording.active && !recording.busy) return;
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        Alert.alert(
          recording.active ? '录音还在继续' : '录音正在准备',
          recording.active
            ? '离开这个页面不会停止录音。你之后可以从「我的活动」重新打开本场。'
            : '请稍等录音准备完成，避免离开后失去录音控制。',
          [
            { text: '留在这里', style: 'cancel' },
            {
              text: recording.active ? '离开，保持录音' : '仍然离开',
              style: 'destructive',
              onPress: () => router.back(),
            },
          ],
        );
        return true;
      },
    );
    return () => subscription.remove();
  }, [recording.active, recording.busy]);
  return (
    <Page>
      <Heading
        title={recording.active ? '正在记录' : '留住这次见面'}
        subtitle={recording.active?.title ?? '无需起名，先好好聊聊。'}
      />
      {role && (
        <Text style={styles.caption}>
          {role === 'organizer' ? '我是发起人' : '我是参与者 · 私人记录'}
        </Text>
      )}
      <Card>
        <Text style={styles.privacyNote}>
          请确保现场人员知道并同意录音。原始录音会保存在这台手机。
        </Text>
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
          accessible
          accessibilityLabel={
            recording.status === 'recording'
              ? '录音正在进行，音量有反馈'
              : '音量反馈'
          }
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
        <Text
          accessibilityLiveRegion="polite"
          style={[styles.body, { textAlign: 'center' }]}
        >
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
          {recording.status === 'interrupted' ? (
            <Card>
              <Text style={styles.label}>这段录音已中断</Text>
              <Text style={styles.body}>
                结束并保存后，请试听确认文件是否完整。中断期间没有录到的声音无法补回。
              </Text>
            </Card>
          ) : (
            <Action
              label={recording.status === 'paused' ? '继续记录' : '暂停一下'}
              disabled={recording.busy}
              onPress={() =>
                void (recording.status === 'paused'
                  ? recording.resume()
                  : recording.pause())
              }
            />
          )}
          <Action
            secondary
            label="完成并保存"
            disabled={recording.busy}
            onPress={() => {
              const id = recording.active?.sessionId;
              if (!id) return;
              void recording.finish().then(() => setSavedId(id));
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
          <Text style={styles.caption}>
            只有生成加入码后，活动名称和参与者可见范围才会同步到服务端。录音不会上传。
          </Text>
          {qr ? (
            <>
              <Image
                source={{ uri: qr }}
                style={{ width: 200, height: 200, alignSelf: 'center' }}
              />
              <Text style={styles.caption}>请大家用微信扫一扫，加入这场。</Text>
            </>
          ) : (
            <>
              {!!qrError && (
                <Text accessibilityRole="alert" style={styles.error}>
                  {qrError}
                </Text>
              )}
              <Action
                label={sharing ? '正在生成加入码…' : '让大家加入'}
                disabled={sharing}
                onPress={() =>
                  Alert.alert(
                    '生成加入码？',
                    '本场名称和参与者可见范围会发送到服务端，用于创建微信加入码。录音仍留在本机。',
                    [
                      { text: '先不生成', style: 'cancel' },
                      {
                        text: '生成加入码',
                        onPress: () => void createJoinCode(),
                      },
                    ],
                  )
                }
              />
            </>
          )}
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
      {!recording.active && !savedId && (
        <Action
          secondary
          label="返回首页"
          onPress={() => router.replace('/')}
        />
      )}
    </Page>
  );
}
