import { useState } from 'react';
import { View, Text, Input, Button, Switch } from '@tarojs/components';
import Taro, { useLoad } from '@tarojs/taro';
import { profileSchema, type Profile } from '@pengtou/contracts';
import { login, request, currentSessionId, message } from '../../lib/api';
const fields: [keyof Profile, string][] = [
  ['name', '名字 / 昵称'],
  ['introduction', '一句话介绍'],
  ['workingOn', '最近在搞什么'],
  ['wantToDiscuss', '今天想聊什么'],
  ['wantToMeet', '想认识什么样的人'],
  ['canDiscuss', '可以找我聊什么'],
  ['organization', '公司 / 组织'],
  ['occupation', '职业'],
  ['city', '城市'],
  ['publicLink', '公开账号链接'],
];
export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile>({
    name: '',
    introduction: '',
  });
  const [reuse, setReuse] = useState(false);
  const [save, setSave] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [editSaved, setEditSaved] = useState(false);
  useLoad((options) => {
    setEditSaved(options.mode === 'saved');
    void login()
      .then(() => request<{ profile: Profile | null }>('/me/profile'))
      .then((result) => {
        if (result.profile) {
          setProfile(result.profile);
          setReuse(options.mode !== 'saved');
        }
      })
      .catch((e) => setError(message(e)));
  });
  async function submit() {
    if (busy) return;
    // 微信小程序不允许动态构造函数，使用 Zod 的解释执行校验路径。
    const parsed = profileSchema.safeParse(profile, { jitless: true });
    if (!parsed.success) {
      const field = parsed.error.issues[0]?.path[0];
      const label = fields.find(([key]) => key === field)?.[1] ?? '资料';
      setError(
        field === 'publicLink'
          ? '请填写有效的 https 公开链接'
          : `请检查「${label}」是否填写完整或超过字数限制`,
      );
      return;
    }
    setBusy(true);
    setError('');
    try {
      await login();
      if (editSaved) await request('/me/profile', 'PUT', parsed.data);
      else
        await request(`/sessions/${currentSessionId()}/join`, 'POST', {
          profile: parsed.data,
          saveProfile: save,
        });
      await Taro.switchTab({
        url: editSaved ? '/pages/me/index' : '/pages/session/people',
      });
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <View className="page">
      <Text className="title">{reuse ? '欢迎回来' : '认识一下'}</Text>
      {reuse ? (
        <View className="hero">
          <Text className="title">{profile.name}</Text>
          <Text className="subtitle">{profile.introduction}</Text>
          <Button
            className="button"
            disabled={busy}
            onClick={() => void submit()}
          >
            就用这个加入
          </Button>
          <Button onClick={() => setReuse(false)}>修改</Button>
        </View>
      ) : (
        <View className="card">
          {fields.map(([key, label]) => (
            <View key={key}>
              <Text className="hint">
                {label}
                {key === 'name' || key === 'introduction'
                  ? ' · 必填'
                  : ' · 可选'}
              </Text>
              <Input
                className="field"
                value={profile[key] ?? ''}
                placeholder={label}
                onInput={(e) =>
                  setProfile({ ...profile, [key]: e.detail.value || undefined })
                }
              />
            </View>
          ))}
        </View>
      )}
      {!editSaved && (
        <View className="card">
          <Text className="subtitle">
            保存，下次直接用{' '}
            <Switch
              checked={save}
              color="#426B4E"
              onChange={(e) => setSave(e.detail.value)}
            />
          </Text>
          <Text className="hint">
            {save
              ? '保存后，下次参加使用倾盖如故的活动可以直接复用。'
              : '仅本场使用，不修改你之前保存的资料。'}
          </Text>
          <Text className="hint">
            你填写的信息将按照本场活动设置展示给主办方和/或本场参与者。
          </Text>
        </View>
      )}
      {error && <Text className="hint">{error}</Text>}
      {!reuse && (
        <Button
          className="button"
          disabled={busy}
          onClick={() => void submit()}
        >
          {busy ? '正在保存…' : editSaved ? '保存资料' : '加入这场'}
        </Button>
      )}
    </View>
  );
}
