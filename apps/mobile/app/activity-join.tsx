import { useState } from 'react';
import { Platform, Text } from 'react-native';
import { router } from 'expo-router';
import { Page, Heading, Card, Action, Field, styles } from '../src/ui';
import { bindingStatus, cloudRequest, openCloudActivity } from '../src/cloud';
import type { CloudSession } from '@qinggairugu/contracts';
export default function JoinActivity() {
  const [input, setInput] = useState('');
  const [name, setName] = useState('');
  const [intro, setIntro] = useState('');
  const [session, setSession] = useState<CloudSession | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function preview() {
    if (busy) return;
    setBusy(true);
    setError('');
    setSession(null);
    try {
      if (Platform.OS !== 'android')
        throw new Error(
          '目前 iOS 版尚未开放微信连接；请在微信小程序中扫码加入。',
        );
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
    setError('');
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
      <Field
        label="活动编号或邀请链接"
        value={input}
        onChangeText={setInput}
        placeholder="活动编号或邀请链接"
        autoCapitalize="none"
        autoCorrect={false}
      />
      <Action
        label={busy ? '正在查找…' : '查看这场'}
        disabled={busy || !input.trim()}
        onPress={() => void preview()}
      />
      {Platform.OS === 'android' && !session && (
        <Action
          secondary
          label="关联我的小程序"
          onPress={() => router.push('/binding')}
        />
      )}
      {session && (
        <Card>
          <Text style={styles.label}>{session.title}</Text>
          <Text style={styles.caption}>
            {session.participantVisibility === 'everyone'
              ? '加入后资料对本场参与者可见'
              : '加入后资料仅发起者可见'}
          </Text>
          <Text style={styles.caption}>
            你填写的信息只用于这场活动，并按本场可见范围向相关人员展示。
          </Text>
          <Field
            label="名字 / 昵称"
            value={name}
            onChangeText={setName}
            placeholder="希望大家怎么称呼你？"
            autoComplete="name"
          />
          <Field
            label="一句话介绍"
            value={intro}
            onChangeText={setIntro}
            placeholder="一句话介绍"
            multiline
            maxLength={240}
          />
          <Action
            label={busy ? '正在加入…' : '确认资料并加入'}
            disabled={busy || !name.trim() || !intro.trim()}
            onPress={() => void join()}
          />
        </Card>
      )}
      {!!error && (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}
    </Page>
  );
}
