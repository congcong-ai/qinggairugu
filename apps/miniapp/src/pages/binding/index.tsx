import { useState } from 'react';
import { View, Text, Input, Button } from '@tarojs/components';
import Taro, { useLoad, useDidShow } from '@tarojs/taro';
import { login, request, message } from '../../lib/api';
export default function Binding() {
  const [code, setCode] = useState('');
  const [status, setStatus] = useState('');
  const [rows, setRows] = useState<{ id: string; installationId: string }[]>(
    [],
  );
  const [busy, setBusy] = useState(false);
  useLoad((o) => {
    if (o.code) setCode(o.code);
  });
  const load = () =>
    login()
      .then(() => request<{ bindings: typeof rows }>('/bindings'))
      .then((r) => setRows(r.bindings))
      .catch((e) => setStatus(message(e)));
  useDidShow(() => {
    void load();
  });
  async function claim() {
    if (busy) return;
    if (
      !(
        await Taro.showModal({
          title: '关联这台 App？',
          content:
            '确认后还需在 App 确认。仅在你主动同步后，才能在这里看到 App 整理的私人文本。',
        })
      ).confirm
    )
      return;
    setBusy(true);
    try {
      await login();
      await request('/bindings/claim', 'POST', { code: code.trim() });
      setStatus('已认领，请回到 App 核对身份并确认。');
    } catch (e) {
      setStatus(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <View className="page">
      <Text className="title">关联我的 App</Text>
      <View className="hero">
        <Text className="subtitle">在 App「我的」获取一次性关联码。</Text>
        <Input
          className="field"
          value={code}
          placeholder="输入 App 显示的关联码"
          onInput={(e) => setCode(e.detail.value)}
        />
        <Button
          className="button"
          disabled={busy || !code.trim()}
          onClick={() => void claim()}
        >
          确认是我的 App
        </Button>
      </View>
      <Text className="hint">{status}</Text>
      {rows.map((b) => (
        <View key={b.id} className="card">
          <Text>设备 · {b.installationId.slice(-6)}</Text>
          <Button
            onClick={() => {
              void Taro.showModal({
                title: '解除关联？',
                content:
                  '这台设备同步的 AI 云端副本将删除；本机原件和独立心得保留。',
              })
                .then(async (r) => {
                  if (r.confirm) {
                    await request(`/bindings/${b.id}`, 'DELETE');
                    await load();
                  }
                })
                .catch((e) => setStatus(message(e)));
            }}
          >
            解除关联
          </Button>
        </View>
      ))}
    </View>
  );
}
