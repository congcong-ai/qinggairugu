import { useState } from 'react';
import { Text } from 'react-native';
import { randomUUID } from 'expo-crypto';
import { router } from 'expo-router';
import { Page, Heading, Card, Action, Field, styles } from '../src/ui';
import { getDatabase } from '../src/storage/database';
export default function Create() {
  const [title, setTitle] = useState('');
  const [startsAt, setStartsAt] = useState('');
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
      setError('请填写有效的本地时间，格式为 YYYY-MM-DD HH:mm。');
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
        'everyone',
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
      <Heading
        title="提前创建一场"
        subtitle="先准备好邀请码，见面时再开始记录。"
      />
      <Card>
        <Field
          label="这场叫什么"
          placeholder="这场叫什么？"
          value={title}
          maxLength={120}
          onChangeText={setTitle}
          returnKeyType="next"
        />
        <Field
          label="时间（可选）"
          placeholder="YYYY-MM-DD HH:mm"
          hint="按本机时间填写，格式：YYYY-MM-DD HH:mm。"
          value={startsAt}
          onChangeText={setStartsAt}
          keyboardType="numbers-and-punctuation"
          autoCapitalize="none"
        />
        <Text style={styles.caption}>
          扫码加入后，本场参与者可以互相查看彼此的「关于我」。
        </Text>
      </Card>
      {error && (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}
      <Action
        label={busy ? '正在创建…' : '创建并生成加入码'}
        disabled={busy}
        onPress={() => void create()}
      />
    </Page>
  );
}
