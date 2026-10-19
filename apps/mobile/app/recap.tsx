import { useEffect, useState } from 'react';
import { Alert, Text, TextInput } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Page, Heading, Action, styles } from '../src/ui';
import { getDatabase } from '../src/storage/database';
import { ensureCloudSession, cloudRequest } from '../src/cloud';
export default function Recap() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [content, setContent] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void getDatabase()
      .then((db) =>
        db.getFirstAsync<{ content: string }>(
          "SELECT content FROM summaries WHERE session_id=? AND kind='shared'",
          id,
        ),
      )
      .then((row) => setContent(row?.content ?? ''))
      .catch(() => setStatus('草稿读取失败'));
  }, [id]);
  async function save(publish = false) {
    if (busy || !content.trim()) return;
    setBusy(true);
    try {
      const db = await getDatabase();
      await db.runAsync(
        "INSERT INTO summaries(id,session_id,content,kind) VALUES(?,?,?,'shared') ON CONFLICT(id) DO UPDATE SET content=excluded.content",
        `${id}:shared`,
        id,
        content.trim(),
      );
      if (publish) {
        await ensureCloudSession(id);
        await cloudRequest(`/sessions/${id}/recap`, 'POST', {
          content: content.trim(),
        });
        setStatus('已发布，本场参与者可以查看');
      } else setStatus('草稿已保存在本机');
    } catch {
      setStatus('保存或发布未完成，请检查网络后重试');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Page>
      <Heading title="这场回顾" subtitle="发布前，再看一遍。" />
      <Text style={styles.caption}>
        仅下面的内容会分享给本场参与者。完整录音、转写与私人摘要不会随之上传。
      </Text>
      <TextInput
        accessibilityLabel="共享回顾草稿"
        multiline
        value={content}
        onChangeText={setContent}
        maxLength={20000}
        textAlignVertical="top"
        style={{
          backgroundColor: 'white',
          borderRadius: 20,
          padding: 20,
          minHeight: 320,
          fontSize: 17,
          lineHeight: 28,
        }}
      />
      <Action
        secondary
        label="保存草稿"
        disabled={busy || !content.trim()}
        onPress={() => void save()}
      />
      <Action
        label="发布这场回顾"
        disabled={busy || !content.trim()}
        onPress={() =>
          Alert.alert('发布这场回顾？', '本场参与者将能看到上面的内容。', [
            { text: '再检查一下', style: 'cancel' },
            { text: '确认发布', onPress: () => void save(true) },
          ])
        }
      />
      <Text style={styles.body}>{status}</Text>
    </Page>
  );
}
