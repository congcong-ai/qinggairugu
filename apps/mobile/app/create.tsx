import { useState } from 'react';
import { Text, TextInput, Switch } from 'react-native';
import { randomUUID } from 'expo-crypto';
import { router } from 'expo-router';
import { Page, Heading, Card, Action, styles } from '../src/ui';
import { getDatabase } from '../src/storage/database';
export default function Create() {
  const [title, setTitle] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [privatePeople, setPrivate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function create() {
    if (busy) return;
    if (!title.trim()) {
      setError('给这次见面起个名字吧');
      return;
    }
    const match = startsAt
      .trim()
      .match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/);
    const date = match
      ? new Date(
          Number(match[1]),
          Number(match[2]) - 1,
          Number(match[3]),
          Number(match[4]),
          Number(match[5]),
        )
      : null;
    if (
      startsAt &&
      (!date ||
        date.getFullYear() !== Number(match?.[1]) ||
        date.getMonth() + 1 !== Number(match?.[2]) ||
        date.getDate() !== Number(match?.[3]) ||
        date.getHours() !== Number(match?.[4]) ||
        date.getMinutes() !== Number(match?.[5]))
    ) {
      setError('请填写有效的本地时间，例如 2026-10-17 14:30');
      return;
    }
    setBusy(true);
    try {
      const db = await getDatabase();
      const id = randomUUID();
      const now = new Date().toISOString();
      await db.runAsync(
        'INSERT INTO sessions(id,title,state,created_at,updated_at,participant_visibility,starts_at) VALUES(?,?,?,?,?,?,?)',
        id,
        title.trim(),
        'ready',
        now,
        now,
        privatePeople ? 'organizer_only' : 'everyone',
        date ? date.toISOString() : null,
      );
      router.replace({ pathname: '/join', params: { id } });
    } catch {
      setError('创建失败，请重试');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Page>
      <Heading title="发起活动" subtitle="先约好，再慢慢聊。" />
      <Card>
        <TextInput
          accessibilityLabel="这场叫什么"
          placeholder="这场叫什么？"
          value={title}
          maxLength={120}
          onChangeText={setTitle}
          style={{ fontSize: 22, padding: 12 }}
        />
        <TextInput
          accessibilityLabel="时间（可选）"
          placeholder="时间（可选）：2026-10-17 14:30"
          value={startsAt}
          onChangeText={setStartsAt}
          style={{ padding: 12, fontSize: 16 }}
        />
        <Text style={styles.label}>参与者资料仅主办方可见</Text>
        <Switch value={privatePeople} onValueChange={setPrivate} />
        <Text style={styles.caption}>
          {privatePeople
            ? '参与者不会互相看到资料。'
            : '本场参与者可以互相查看「关于我」。'}
        </Text>
      </Card>
      {error && <Text style={styles.body}>{error}</Text>}
      <Action
        label="创建并邀请大家"
        disabled={busy}
        onPress={() => void create()}
      />
    </Page>
  );
}
