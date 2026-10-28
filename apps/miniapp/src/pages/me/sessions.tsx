import { useState } from 'react';
import { View, Text, Button } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import { login, request, setSessionId, message } from '../../lib/api';
export default function Sessions() {
  const [rows, setRows] = useState<
    {
      id: string;
      title: string;
      createdAt: string;
      recapPublishedAt: string | null;
    }[]
  >([]);
  const [error, setError] = useState('');
  useDidShow(() => {
    void login()
      .then(() => request<typeof rows>('/me/sessions'))
      .then(setRows)
      .catch((e) => setError(message(e)));
  });
  return (
    <View className="page">
      <Text className="title">我参加过的</Text>
      {error && <Text>{error}</Text>}
      {rows.length === 0 && (
        <Text className="subtitle">下一次见面，值得期待。</Text>
      )}
      {rows.map((row) => (
        <View className="card" key={row.id}>
          <Text className="title">{row.title}</Text>
          <Text className="hint">
            {row.createdAt.slice(0, 10)} ·{' '}
            {row.recapPublishedAt ? '已发布回顾' : '等待回顾'}
          </Text>
          <Button
            className="row-button"
            onClick={() => {
              setSessionId(row.id);
              void Taro.navigateTo({ url: '/pages/session/index' });
            }}
          >
            再看看这场
          </Button>
        </View>
      ))}
    </View>
  );
}
