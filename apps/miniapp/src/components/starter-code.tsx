import { dateInputToISOString } from '@pengtou/shared';
import { useRef, useState } from 'react';
import { View, Text, Button, Input, Image } from '@tarojs/components';
import Taro from '@tarojs/taro';
import type { Profile } from '@pengtou/contracts';
import { login, request, message, setSessionId } from '../lib/api';
export function StarterCode({ title, date }: { title: string; date: string }) {
  const [open, setOpen] = useState(false),
    [name, setName] = useState(''),
    [intro, setIntro] = useState(''),
    [qr, setQr] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const id = useRef('');
  async function show() {
    setOpen(true);
    try {
      await login();
      const r = await request<{ profile: Profile | null }>('/me/profile');
      if (r.profile) {
        setName(r.profile.name);
        setIntro(r.profile.introduction);
      }
    } catch (e) {
      setError(message(e));
    }
  }
  async function generate() {
    if (busy) return;
    setBusy(true);
    id.current ||= 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(
      /[xy]/g,
      (c) => {
        const r = Math.floor(Math.random() * 16);
        return (c === 'x' ? r : (r & 3) | 8).toString(16);
      },
    );
    try {
      const r = await request<{ imageDataUrl: string }>(
        '/activity-starters',
        'POST',
        {
          id: id.current,
          title: title.trim() || '一次相聚',
          startsAt: dateInputToISOString(date),
          profile: { name: name.trim(), introduction: intro.trim() },
        },
      );
      const path = Taro.env.USER_DATA_PATH + '/starter-' + id.current + '.png';
      Taro.getFileSystemManager().writeFileSync(
        path,
        r.imageDataUrl.split(',')[1]!,
        'base64',
      );
      setQr(path);
      setError('');
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  async function check() {
    try {
      const r = await request<{ claimed: boolean; sessionId: string | null }>(
        `/activity-starters/${id.current}`,
      );
      if (r.sessionId) {
        setSessionId(r.sessionId);
        await Taro.navigateTo({
          url: '/pages/session/index?sid=' + r.sessionId,
        });
      } else setError('组织者尚未扫码，稍后再查看。');
    } catch (e) {
      setError(message(e));
    }
  }
  return (
    <View>
      {!open ? (
        <Button className="row-button text-action" onClick={() => void show()}>
          请组织者快速发起活动
        </Button>
      ) : (
        <View className="card">
          <Text className="row-title">给组织者扫的发起码</Text>
          <Text className="hint">
            组织者扫码即创建活动并显示加入码，你会自动加入。仅传递活动名称、时间和以下关于我；心得、录音及私人整理不会给组织者。
          </Text>
          {!qr ? (
            <>
              <Input
                className="field"
                placeholder="你的名字 / 昵称"
                value={name}
                onInput={(e) => setName(e.detail.value)}
              />
              <Input
                className="field"
                placeholder="一句话介绍"
                value={intro}
                onInput={(e) => setIntro(e.detail.value)}
              />
              <Button
                className="row-button button"
                disabled={busy || !name.trim() || !intro.trim()}
                onClick={() => void generate()}
              >
                生成发起码
              </Button>
            </>
          ) : (
            <>
              <Image src={qr} className="join-code" mode="aspectFit" />
              <Text className="hint">请组织者用微信扫码 · 24 小时内有效</Text>
              <Button className="row-button" onClick={() => void check()}>
                查看组织者是否已发起
              </Button>
            </>
          )}
          {error && <Text className="hint">{error}</Text>}
        </View>
      )}
    </View>
  );
}
