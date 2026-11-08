import { useState } from 'react';
import { Text, Switch, View } from 'react-native';
import { colors } from '@qinggairugu/design-tokens';
import { randomUUID } from 'expo-crypto';
import { router } from 'expo-router';
import { Page, Heading, Card, Action, Field, styles } from '../src/ui';
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
        <View style={styles.switchRow}>
          <View style={styles.switchCopy}>
            <Text style={styles.label}>参与者资料仅主办方可见</Text>
            <Text style={styles.caption}>
              {privatePeople
                ? '开启后，参与者不会互相看到彼此的介绍。'
                : '关闭时，本场参与者可以互相查看「关于我」。'}
            </Text>
          </View>
          <Switch
            accessibilityLabel="参与者资料仅主办方可见"
            accessibilityHint="关闭时，本场参与者可以互相查看关于我"
            value={privatePeople}
            onValueChange={setPrivate}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor="white"
          />
        </View>
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
