import { useState, useEffect } from 'react';
import { Text, Alert } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Page, Heading, Card, Action, styles } from '../src/ui';
import { refreshActivities, bindingStatus, cloudRequest } from '../src/cloud';
import { getDatabase } from '../src/storage/database';
import { activeAIJobs, activeAudioImports } from '../src/activity';
import type { ActivityItem } from '@pengtou/contracts';
export default function Link() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [rows, setRows] = useState<ActivityItem[]>([]);
  const [status, setStatus] = useState('');
  useEffect(() => {
    void refreshActivities()
      .then(setRows)
      .catch((e) => setStatus(e.message));
  }, []);
  async function link(sid: string | null) {
    try {
      const db = await getDatabase();
      if (
        activeAIJobs.has(id) ||
        activeAudioImports.has(id) ||
        (await db.getFirstAsync(
          "SELECT id FROM recordings WHERE session_id=? AND status IN ('recording','paused')",
          id,
        ))
      )
        throw new Error('请先完成录音或整理后再关联');
      const entry = await db.getFirstAsync<{
        cloud_entry_id: string | null;
        cloud_owner_id: string | null;
        cloud_version: number;
      }>('SELECT * FROM personal_entries WHERE id=?', id);
      if (entry?.cloud_entry_id) {
        const b = await bindingStatus();
        if (b.userId !== entry.cloud_owner_id)
          throw new Error('请关联原微信身份后修改云端引用');
        const result = await cloudRequest<{ version: number }>(
          `/me/entries/${entry.cloud_entry_id}`,
          'PATCH',
          { version: entry.cloud_version, sessionId: sid },
        );
        await db.runAsync(
          'UPDATE personal_entries SET cloud_version=? WHERE id=?',
          result.version,
          id,
        );
      }
      await db.withExclusiveTransactionAsync(async (tx) => {
        await tx.runAsync('UPDATE sessions SET cloud_id=? WHERE id=?', sid, id);
        await tx.runAsync('DELETE FROM participants WHERE session_id=?', id);
      });
      setStatus(
        '已更新引用，原录音、照片和心得保留。已同步 AI 副本不会自动改写，请重新确认同步。',
      );
    } catch (e) {
      setStatus(e instanceof Error ? e.message : '未完成');
    }
  }
  return (
    <Page>
      <Heading
        title="关联到一场活动"
        subtitle="只建立引用，不移动录音，不公开私人内容。"
      />
      {rows
        .filter((r) => r.sessionId && r.relation !== 'private')
        .map((r) => (
          <Card key={r.id}>
            <Text style={styles.label}>{r.title}</Text>
            <Action
              secondary
              label="关联这场"
              onPress={() =>
                Alert.alert(
                  '确认是同一次活动？',
                  '本地录音和照片不会上传，心得仍只有你可见。',
                  [
                    { text: '取消', style: 'cancel' },
                    { text: '确认关联', onPress: () => void link(r.sessionId) },
                  ],
                )
              }
            />
          </Card>
        ))}
      <Action
        secondary
        label="解除共享活动引用"
        onPress={() =>
          Alert.alert('解除关联？', '只移除本地引用，不删除原共享场次。', [
            { text: '取消', style: 'cancel' },
            { text: '解除', onPress: () => void link(null) },
          ])
        }
      />
      <Text style={styles.caption}>{status}</Text>
    </Page>
  );
}
