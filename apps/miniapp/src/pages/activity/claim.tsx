import { useState } from 'react';
import { View, Text, Button } from '@tarojs/components';
import Taro, { useLoad } from '@tarojs/taro';
import { login, request, message, setSessionId } from '../../lib/api';
import { sessionIdFromRoute } from '../../lib/session-route';
export default function Claim() {
  const [error, setError] = useState('');
  useLoad((options) => {
    void (async () => {
      try {
        const id = sessionIdFromRoute(options);
        await login();
        const r = await request<{ sessionId: string }>(
          `/activity-starters/${id}/claim`,
          'POST',
          {},
        );
        setSessionId(r.sessionId);
        await Taro.redirectTo({
          url: `/pages/session/index?sid=${r.sessionId}`,
        });
      } catch (e) {
        setError(message(e));
      }
    })();
  });
  return (
    <View className="page">
      <Text className="title">
        {error ? '未能发起活动' : '正在为你创建活动'}
      </Text>
      <Text className="hint">
        {error || '创建后直接显示加入码，参与者私人内容不会带入。'}
      </Text>
      {error && (
        <Button
          className="row-button"
          onClick={() => Taro.switchTab({ url: '/pages/activity/index' })}
        >
          回到我的活动
        </Button>
      )}
    </View>
  );
}
