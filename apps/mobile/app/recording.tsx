import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Page, Heading, Card, Action, styles } from '../src/ui';
import { useRecording } from '../src/recording-context';
import { formatDuration } from '@pengtou/shared';
import { colors } from '@pengtou/design-tokens';
export default function Recording() {
  const recording = useRecording();
  const started = useRef(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  const { sid } = useLocalSearchParams<{ sid?: string }>();
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
      {recording.active && (
        <Action
          secondary
          label="让大家加入"
          onPress={() =>
            router.push({
              pathname: '/join',
              params: { id: recording.active!.sessionId },
            })
          }
        />
      )}
      <Text style={styles.caption}>
        录音原文件长期保存在你的设备。AI 整理时会临时发送给你配置的 AI
        服务处理。
      </Text>
      <Action secondary label="返回首页" onPress={() => router.replace('/')} />
    </Page>
  );
}
