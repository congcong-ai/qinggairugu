import { SessionNav } from '../../components/session-nav';
import { sessionIdFromRoute } from '../../lib/session-route';
import { useState, useRef } from 'react';
import { View, Text } from '@tarojs/components';
import { useDidShow, useDidHide, useLoad } from '@tarojs/taro';
import { request, currentSessionId, message } from '../../lib/api';
export default function Recap() {
  const [content, setContent] = useState('主办方还没有发布这场回顾。');
  const ownSession = useRef('');
  const generation = useRef(0);
  useLoad((options) => {
    try {
      ownSession.current = sessionIdFromRoute(options, currentSessionId());
    } catch (e) {
      setContent(message(e));
    }
  });
  useDidHide(() => {
    generation.current++;
    setContent('正在核对本场权限…');
  });
  useDidShow(() => {
    const ticket = ++generation.current;
    const id = ownSession.current;
    if (!id) {
      setContent('先扫码进入一场见面。');
      return;
    }
    void request<{ recap: { content: string } | null }>(`/sessions/${id}/recap`)
      .then((result) => {
        if (ticket === generation.current)
          setContent(result.recap?.content || '主办方还没有发布这场回顾。');
      })
      .catch((e) => {
        if (ticket === generation.current) setContent(message(e));
      });
  });
  return (
    <View className="page">
      <SessionNav active="recap" />
      <Text className="title">这场回顾</Text>
      <View className="card">
        <Text className="subtitle" style={{ whiteSpace: 'pre-wrap' }}>
          {content}
        </Text>
      </View>
    </View>
  );
}
