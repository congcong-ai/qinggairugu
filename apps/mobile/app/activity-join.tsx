import { useState } from 'react';
import { Text, TextInput } from 'react-native';
import { router } from 'expo-router';
import { Page, Heading, Card, Action, styles } from '../src/ui';
import { bindingStatus, cloudRequest, openCloudActivity } from '../src/cloud';
import type { CloudSession } from '@pengtou/contracts';
export default function JoinActivity() {
  const [input, setInput] = useState('');
  const [name, setName] = useState('');
  const [intro, setIntro] = useState('');
  const [session, setSession] = useState<CloudSession | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function preview() {
    setBusy(true);
    try {
      const b = await bindingStatus();
      if (!b.userId)
        throw new Error(
          '请先关联本人小程序，也可以先在微信扫码加入，再回到我的活动。',
        );
      const id = input.trim().match(/[0-9a-f]{8}-[0-9a-f-]{27}/i)?.[0];
      if (!id) throw new Error('请粘贴活动编号或包含编号的邀请链接');
      setSession(await cloudRequest(`/sessions/${id}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : '未完成');
    } finally {
      setBusy(false);
    }
  }
  async function join() {
    if (!session) return;
    setBusy(true);
    try {
      await cloudRequest(`/sessions/${session.id}/join`, 'POST', {
        profile: { name, introduction: intro },
        saveProfile: false,
      });
      const id = await openCloudActivity(session.id);
      router.replace({ pathname: '/session/[id]', params: { id } });
    } catch (e) {
      setError(e instanceof Error ? e.message : '未完成');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Page>
      <Heading
        title="加入这场"
        subtitle="我是参与者 · 也可以先用微信扫码加入"
      />
      <TextInput
        value={input}
        onChangeText={setInput}
        placeholder="活动编号或邀请链接"
        style={styles.body}
      />
      <Action label="查看这场" disabled={busy} onPress={() => void preview()} />
      {session && (
        <Card>
          <Text style={styles.label}>{session.title}</Text>
          <Text style={styles.caption}>
            {session.participantVisibility === 'everyone'
              ? '加入后资料对本场参与者可见'
              : '加入后资料仅发起者可见'}
          </Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="名字 / 昵称"
            style={styles.body}
          />
          <TextInput
            value={intro}
            onChangeText={setIntro}
            placeholder="一句话介绍"
            style={styles.body}
          />
          <Action
            label="确认资料并加入"
            disabled={busy || !name.trim() || !intro.trim()}
            onPress={() => void join()}
          />
        </Card>
      )}
      <Text style={styles.caption}>{error}</Text>
    </Page>
  );
}
