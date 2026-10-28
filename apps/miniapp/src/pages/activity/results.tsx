import { useState, useRef } from 'react';
import { View, Text, Button } from '@tarojs/components';
import { useLoad, useDidShow, useDidHide } from '@tarojs/taro';
import Taro from '@tarojs/taro';
import type { PrivateAIInput } from '@pengtou/contracts';
import { login, request, message } from '../../lib/api';
type Result = PrivateAIInput & { id: string; updatedAt: string };
export default function Results() {
  const [rows, setRows] = useState<Result[]>([]);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<{ sid?: string; localId?: string }>({});
  useLoad((o) => setFilter(o));
  const generation = useRef(0);
  const load = async () => {
    const ticket = ++generation.current;
    setRows([]);
    setError('');
    try {
      await login();
      const result = await request<Result[]>('/me/private-ai');
      if (ticket === generation.current) setRows(result);
    } catch (e) {
      if (ticket === generation.current) setError(message(e));
    }
  };
  useDidShow(() => {
    void load();
  });
  useDidHide(() => {
    generation.current++;
    setRows([]);
    setError('');
  });
  const list = rows.filter(
    (r) =>
      (!filter.sid || r.sessionId === filter.sid) &&
      (!filter.localId || r.localSessionId === filter.localId),
  );
  return (
    <View className="page">
      <Text className="title">我的整理结果</Text>
      <Text className="hint">只有我可见 · 与本场共享回顾分别保存</Text>
      {error && <Text>{error}</Text>}
      {!list.length && (
        <View className="card">
          <Text className="subtitle">
            这里还没有同步结果。录音和整理结果可能仅在原 App
            中，请先关联身份，再在 App 主动同步。
          </Text>
        </View>
      )}
      {list.map((r) => (
        <View className="card" key={r.id}>
          <Text className="title">{r.title}</Text>
          <Text className="hint">
            设备结果 · {new Date(r.updatedAt).toLocaleString()}
          </Text>
          {r.content.summary && (
            <Text className="subtitle">{r.content.summary}</Text>
          )}
          {r.content.topics?.map((v, i) => (
            <Text key={i}>话题 · {v}</Text>
          ))}
          {r.content.actions?.map((v, i) => (
            <Text key={i}>行动 · {v}</Text>
          ))}
          {r.content.speakers?.map((v) => (
            <Text key={v.id}>{v.label}</Text>
          ))}
          {r.content.transcript?.map((v) => (
            <Text key={v.id} className="subtitle">
              {Math.floor(v.startMs / 1000)} 秒 · {v.text}
            </Text>
          ))}
          <Button
            className="row-button"
            onClick={() => {
              void Taro.showModal({
                title: '删除云端副本？',
                content: '不会删除 App 中的原件。',
              })
                .then(async (x) => {
                  if (x.confirm) {
                    await request(`/me/private-ai/${r.id}`, 'DELETE');
                    await load();
                  }
                })
                .catch((e) => setError(message(e)));
            }}
          >
            取消同步并删除云端副本
          </Button>
        </View>
      ))}
    </View>
  );
}
