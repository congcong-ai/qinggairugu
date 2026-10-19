import { useState } from 'react';
import { View, Text, Button, Input } from '@tarojs/components';
import Taro, { useLoad, useDidShow } from '@tarojs/taro';
import type { CloudSession } from '@pengtou/contracts';
import {
  currentSessionId,
  setSessionId,
  request,
  message,
} from '../../lib/api';
export default function SessionPage() {
  const [session, setSession] = useState<CloudSession | null>(null);
  const [error, setError] = useState('');
  const [input, setInput] = useState('');
  const refresh = () => {
    const id = currentSessionId();
    if (id)
      void request<CloudSession>(`/sessions/${id}`)
        .then(setSession)
        .catch((e) => setError(message(e)));
  };
  useLoad((options) => {
    const scene = decodeURIComponent(options.scene || '');
    const id =
      options.sid ||
      (scene.length === 32
        ? `${scene.slice(0, 8)}-${scene.slice(8, 12)}-${scene.slice(12, 16)}-${scene.slice(16, 20)}-${scene.slice(20)}`
        : '');
    if (id) setSessionId(id);
    refresh();
  });
  useDidShow(refresh);
  return (
    <View className="page">
      <Text className="eyebrow">倾盖如故 · 把每一次见面留下来</Text>
      <View className="hero">
        <Text className="title">{session?.title || '很高兴在这里遇见你'}</Text>
        <Text className="subtitle">
          {session
            ? `已有 ${session.participantCount} 人在这里`
            : '扫码进入一场见面，认识在场的人。'}
        </Text>
        {session && (
          <Button
            className="button"
            onClick={() => Taro.navigateTo({ url: '/pages/profile/edit' })}
          >
            加入这场
          </Button>
        )}
      </View>
      {!session && process.env.NODE_ENV !== 'production' && (
        <View className="card">
          <Input
            placeholder="开发调试：输入 Session 编号"
            value={input}
            onInput={(e) => setInput(e.detail.value)}
          />
          <Button
            onClick={() => {
              setSessionId(input.trim());
              refresh();
            }}
          >
            打开这场
          </Button>
        </View>
      )}
      {error && <Text className="hint">{error}</Text>}
      {session && (
        <View className="card">
          <Text className="hint">
            {session.participantVisibility === 'everyone'
              ? '本场参与者可以互相查看「关于我」。'
              : '你的资料仅主办方可见。'}
          </Text>
        </View>
      )}
    </View>
  );
}
