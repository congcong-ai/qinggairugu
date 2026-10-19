import { useState } from 'react';
import { View, Text } from '@tarojs/components';
import { useDidShow } from '@tarojs/taro';
import { request, currentSessionId, message } from '../../lib/api';
export default function Recap() {
  const [content, setContent] = useState('主办方还没有发布这场回顾。');
  useDidShow(() => {
    const id = currentSessionId();
    if (!id) {
      setContent('先扫码进入一场见面。');
      return;
    }
    void request<{ recap: { content: string } | null }>(`/sessions/${id}/recap`)
      .then((result) =>
        setContent(result.recap?.content || '主办方还没有发布这场回顾。'),
      )
      .catch((e) => setContent(message(e)));
  });
  return (
    <View className="page">
      <Text className="title">这场回顾</Text>
      <View className="card">
        <Text className="subtitle" style={{ whiteSpace: 'pre-wrap' }}>
          {content}
        </Text>
      </View>
    </View>
  );
}
