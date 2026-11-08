import { useEffect, useState } from 'react';
import { Alert, Text } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Page, Heading, Action, Field, styles } from '../src/ui';
import { getDatabase } from '../src/storage/database';
import { ensureCloudSession, cloudRequest, cloudSessionId } from '../src/cloud';
export default function Recap() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [content, setContent] = useState('');
  const [version, setVersion] = useState<number | null>(null);
  const [organizer, setOrganizer] = useState(false);
  const [status, setStatus] = useState('');
  const [statusError, setStatusError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(true);
  function showStatus(message: string, isError = false) {
    setStatus(message);
    setStatusError(isError);
  }
  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const db = await getDatabase();
        const draft = await db.getFirstAsync<{ content: string }>(
          "SELECT content FROM summaries WHERE session_id=? AND kind='shared'",
          id,
        );
        if (live) setContent(draft?.content ?? '');
      } catch {
        if (live) showStatus('本机草稿读取失败，请稍后重试。', true);
      }
      try {
        const db = await getDatabase();
        const localSession = await db.getFirstAsync<{
          cloud_id: string | null;
        }>('SELECT cloud_id FROM sessions WHERE id=?', id);
        if (!localSession?.cloud_id) {
          if (live) {
            setOrganizer(true);
            setVersion(0);
          }
          return;
        }
        const cloudId = localSession.cloud_id;
        const session = await cloudRequest<{ isOrganizer: boolean }>(
          `/sessions/${cloudId}`,
        );
        const data = await cloudRequest<{
          recap: { content: string; version: number } | null;
          version: number;
        }>(`/sessions/${cloudId}/recap`);
        if (!live) return;
        setOrganizer(session.isOrganizer);
        setVersion(data.version);
        if (!data.recap) return;
        const draft = await db.getFirstAsync<{ content: string }>(
          "SELECT content FROM summaries WHERE session_id=? AND kind='shared'",
          id,
        );
        if (live && !draft) setContent(data.recap.content);
      } catch {
        if (live) showStatus('联网确认本场权限后，才能发布共享回顾。', true);
      } finally {
        if (live) setChecking(false);
      }
    })();
    return () => {
      live = false;
    };
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
        const cloudId = await cloudSessionId(id);
        const result = await cloudRequest<{ version: number }>(
          `/sessions/${cloudId}/recap`,
          'POST',
          { content: content.trim(), version: version ?? 0 },
        );
        setVersion(result.version);
        showStatus('已发布，本场参与者可以查看');
      } else showStatus('草稿已保存在本机');
    } catch {
      showStatus('保存或发布未完成，请检查网络后重试', true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Page>
      <Heading title="这场回顾" subtitle="发布前，再看一遍。" />
      <Text style={styles.privacyNote}>
        只有下面的文字会分享给本场参与者。录音、完整转写和私人摘要不会随之上传；发布前会再次请你确认。
      </Text>
      <Field
        label="回顾正文"
        hint="先保存在本机草稿；确认发布后，本场参与者才能看到。"
        multiline
        value={content}
        onChangeText={setContent}
        maxLength={20000}
        textAlignVertical="top"
        style={{ minHeight: 320, fontSize: 16, lineHeight: 26 }}
      />
      <Action
        secondary
        label="保存草稿"
        disabled={busy || !content.trim()}
        onPress={() => void save()}
      />
      <Action
        label={busy ? '正在发布…' : '发布这场回顾'}
        disabled={busy || !content.trim() || !organizer || version === null}
        onPress={() =>
          Alert.alert(
            '发布这场回顾？',
            '活动名称、参与者可见范围和下方回顾会发送到服务端；本场参与者可以查看回顾。录音、完整转写和私人摘要不会上传。',
            [
              { text: '再检查一下', style: 'cancel' },
              { text: '确认发布', onPress: () => void save(true) },
            ],
          )
        }
      />
      {organizer && (
        <Action
          secondary
          destructive
          label="撤回这场回顾"
          disabled={busy}
          onPress={() =>
            Alert.alert('撤回回顾？', '本场参与者将不能再获取回顾正文。', [
              { text: '取消', style: 'cancel' },
              {
                text: '确认撤回',
                onPress: () => {
                  setBusy(true);
                  void cloudSessionId(id)
                    .then((cid) =>
                      cloudRequest(`/sessions/${cid}/recap`, 'DELETE'),
                    )
                    .then(() => {
                      showStatus('已撤回');
                      setVersion((v) => (v ?? 0) + 1);
                    })
                    .catch(() => showStatus('撤回未完成', true))
                    .finally(() => setBusy(false));
                },
              },
            ])
          }
        />
      )}
      {checking && <Text style={styles.caption}>正在确认本场发布权限…</Text>}
      {!checking && version !== null && !organizer && (
        <Text style={styles.caption}>只有本场发起者可以发布或撤回回顾。</Text>
      )}
      {!!status && (
        <Text
          accessibilityLiveRegion="polite"
          accessibilityRole={statusError ? 'alert' : undefined}
          style={statusError ? styles.error : styles.statusText}
        >
          {status}
        </Text>
      )}
    </Page>
  );
}
