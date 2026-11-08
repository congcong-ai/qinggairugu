import { useRef, useState } from 'react';
import { Text, Image, Platform } from 'react-native';
import { randomUUID } from 'expo-crypto';
import { router } from 'expo-router';
import { Card, Action, Field, styles } from './ui';
import { bindingStatus, cloudRequest } from './cloud';
import type { Profile } from '@qinggairugu/contracts';
export function StarterCode({ title }: { title: string }) {
  const [open, setOpen] = useState(false),
    [name, setName] = useState(''),
    [intro, setIntro] = useState(''),
    [qr, setQr] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [needsBinding, setNeedsBinding] = useState(false);
  const id = useRef('');
  async function show() {
    setOpen(true);
    if (Platform.OS !== 'android') return;
    try {
      const binding = await bindingStatus();
      if (!binding.userId) {
        setNeedsBinding(true);
        return;
      }
      setNeedsBinding(false);
      const r = await cloudRequest<{ profile: Profile | null }>('/me/profile');
      if (r.profile) {
        setName(r.profile.name);
        setIntro(r.profile.introduction);
      }
    } catch {
      setError('暂时无法读取关于我，请联网重试。');
    }
  }
  async function generate() {
    if (busy) return;
    setBusy(true);
    id.current ||= randomUUID();
    try {
      const r = await cloudRequest<{ imageDataUrl: string }>(
        '/activity-starters',
        'POST',
        {
          id: id.current,
          title,
          startsAt: null,
          profile: { name: name.trim(), introduction: intro.trim() },
        },
      );
      setQr(r.imageDataUrl);
      setError('');
    } catch {
      setError('发起码暂不可用，请确认新版后端已部署并联网重试。');
    } finally {
      setBusy(false);
    }
  }
  return !open ? (
    <Action
      secondary
      label="请组织者快速发起活动"
      onPress={() => void show()}
    />
  ) : (
    <Card>
      <Text style={styles.label}>给组织者扫的发起码</Text>
      <Text style={styles.caption}>
        组织者用微信扫码即创建活动，你会自动加入。只传递活动名称和关于我，不传录音、心得或私人整理。
      </Text>
      {Platform.OS !== 'android' ? (
        <Text style={styles.caption}>
          iOS 版暂未开放微信连接。你仍可以继续保存本机录音。
        </Text>
      ) : needsBinding ? (
        <Action
          secondary
          label="先关联我的小程序"
          onPress={() => router.push('/binding')}
        />
      ) : qr ? (
        <>
          <Image
            source={{ uri: qr }}
            style={{ width: 220, height: 220, alignSelf: 'center' }}
          />
          <Text style={styles.caption}>请组织者扫码 · 24 小时内有效</Text>
        </>
      ) : (
        <>
          <Field
            label="你的名字 / 昵称"
            placeholder="名字 / 昵称"
            value={name}
            onChangeText={setName}
          />
          <Field
            label="一句话介绍"
            placeholder="一句话介绍"
            value={intro}
            onChangeText={setIntro}
            multiline
            maxLength={240}
          />
          <Action
            label={busy ? '正在生成…' : '生成发起码'}
            disabled={busy || !name.trim() || !intro.trim()}
            onPress={() => void generate()}
          />
        </>
      )}
      {error && (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}
    </Card>
  );
}
