import { LocalMediaNotice } from '../../src/local-media-notice';
import { importAudio } from '../../src/audio-import';
import { cloudSessionId, cloudRequest } from '../../src/cloud';
import { useEffect, useState } from 'react';
import { Alert, Text, TextInput } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { Page, Heading, Card, Action, styles } from '../../src/ui';
import {
  getDatabase,
  recordingsForSession,
  listSessions,
  renameSession,
  deleteSession,
  deleteRecording,
  confirmInterruptedRecording,
  type LocalRecording,
} from '../../src/storage/database';
import { formatDuration } from '@pengtou/shared';
function Playback({
  recording,
  reload,
}: {
  recording: LocalRecording;
  reload: () => Promise<void>;
}) {
  const [played, setPlayed] = useState(false);
  const [error, setError] = useState('');
  const player = useAudioPlayer(recording.uri);
  const status = useAudioPlayerStatus(player);
  useEffect(() => {
    if (status.didJustFinish && status.duration > 0) setPlayed(true);
  }, [status.didJustFinish, status.duration]);
  return (
    <Card>
      <Text style={styles.label}>{formatDuration(recording.duration_ms)}</Text>
      <Text style={styles.caption}>
        {recording.import_state === 'failed'
          ? '这段导入未完成，请删除此片段后重新选择原文件。'
          : recording.status === 'interrupted'
            ? '此段录音曾中断，文件可能不完整，请试听确认。'
            : '保存在本机'}
      </Text>
      <Action
        secondary
        disabled={recording.import_state === 'failed'}
        label={status.playing ? '暂停播放' : '试听录音'}
        onPress={() => {
          if (status.playing) player.pause();
          else {
            if (status.didJustFinish) void player.seekTo(0);
            player.play();
          }
        }}
      />
      {recording.status === 'interrupted' && (
        <>
          <Text style={styles.caption}>
            完整试听结束后，可将现有片段用于 AI
            整理。中断之后没有录到的声音无法补回。
          </Text>
          <Action
            secondary
            label="确认保留这段声音"
            disabled={!played}
            onPress={() =>
              void confirmInterruptedRecording(
                recording.id,
                status.duration * 1000,
              )
                .then(reload)
                .catch(() => setError('恢复未完成，请重试'))
            }
          />
        </>
      )}
      <Action
        secondary
        label="删除这段录音"
        onPress={() =>
          Alert.alert(
            '删除这段录音？',
            '此文件和本场本地 AI 结果、回顾草稿将删除，其余录音与已发布回顾会保留。',
            [
              { text: '取消', style: 'cancel' },
              {
                text: '删除',
                style: 'destructive',
                onPress: () => {
                  player.pause();
                  void deleteRecording(recording.id)
                    .then(reload)
                    .catch((e) =>
                      setError(e instanceof Error ? e.message : '删除失败'),
                    );
                },
              },
            ],
          )
        }
      />
      {error && <Text style={styles.body}>{error}</Text>}
    </Card>
  );
}
export default function SessionDetail() {
  const [organizer, setOrganizer] = useState(false);
  const [shared, setShared] = useState(false);
  const [importing, setImporting] = useState(false);
  const { id } = useLocalSearchParams<{ id: string }>();
  const [title, setTitle] = useState('');
  const [recordings, setRecordings] = useState<LocalRecording[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    let live = true;
    setOrganizer(false);
    setShared(false);
    void getDatabase()
      .then((db) =>
        db.getFirstAsync<{ cloud_id: string | null }>(
          'SELECT cloud_id FROM sessions WHERE id=?',
          id,
        ),
      )
      .then(async (local) => {
        if (!local) return { isOrganizer: false };
        if (!local.cloud_id) return { isOrganizer: true };
        if (live) setShared(true);
        return cloudRequest<{ isOrganizer: boolean }>(
          `/sessions/${await cloudSessionId(id)}`,
        );
      })
      .then((s) => {
        if (live) setOrganizer(s.isOrganizer);
      })
      .catch(() => {});
    void Promise.all([listSessions(), recordingsForSession(id)])
      .then(([sessions, rows]) => {
        if (live) {
          setTitle(sessions.find((s) => s.id === id)?.title ?? '');
          setRecordings(rows);
        }
      })
      .catch(() => setError('读取记录失败'));
    return () => {
      live = false;
    };
  }, [id]);
  return (
    <Page>
      <Heading title="这次见面" />
      <TextInput
        accessibilityLabel="记录名称"
        value={title}
        onChangeText={setTitle}
        maxLength={120}
        style={{
          backgroundColor: 'white',
          borderRadius: 16,
          padding: 18,
          fontSize: 20,
        }}
      />
      <Action
        secondary
        label="保存名称"
        onPress={() =>
          void renameSession(id, title)
            .then(() => Alert.alert('名称已保存'))
            .catch(() => setError('名称保存失败，请重试'))
        }
      />
      <Action
        secondary
        label="我的心得和照片"
        onPress={() => router.push({ pathname: '/entry', params: { id } })}
      />
      <Action
        secondary
        label={importing ? '正在导入…' : '导入录音'}
        disabled={importing}
        onPress={() => {
          setImporting(true);
          void importAudio(id)
            .then(async () => setRecordings(await recordingsForSession(id)))
            .catch((e) => setError(e.message))
            .finally(() => setImporting(false));
        }}
      />
      <Action
        secondary
        label="关联到已有活动"
        onPress={() =>
          router.push({ pathname: '/activity-link', params: { id } })
        }
      />
      {recordings.map((recording) => (
        <Playback
          key={recording.id}
          recording={recording}
          reload={async () => setRecordings(await recordingsForSession(id))}
        />
      ))}
      <Action
        label="AI 整理本场"
        onPress={() => router.push({ pathname: '/analysis', params: { id } })}
      />
      {shared && (
        <Action
          secondary
          label="这场回顾（本场共享）"
          onPress={() =>
            router.push({ pathname: '/shared-recap', params: { id } })
          }
        />
      )}
      {organizer && (
        <Action
          secondary
          label="让大家加入"
          onPress={() => router.push({ pathname: '/join', params: { id } })}
        />
      )}
      <Text style={styles.body}>
        配置阿里云百炼后，可以进行 AI 整理和搜索。
      </Text>
      <Action
        label="继续记录一段"
        onPress={() =>
          router.push({ pathname: '/recording', params: { sid: id } })
        }
      />
      {error && <Text style={styles.body}>{error}</Text>}
      <Action
        secondary
        label="删除这次记录"
        onPress={() =>
          Alert.alert(
            '删除这次记录？',
            '本机录音、心得、照片与私人整理结果将删除，无法恢复。已经同步的云端私人副本需在小程序单独删除。',
            [
              { text: '取消', style: 'cancel' },
              {
                text: '删除',
                style: 'destructive',
                onPress: () =>
                  void deleteSession(id)
                    .then(() => router.replace('/records'))
                    .catch(() =>
                      setError('删除未完成，请先停止录音或稍后重试'),
                    ),
              },
            ],
          )
        }
      />
      <LocalMediaNotice />
    </Page>
  );
}
