import { useState, useRef } from 'react';
import { View, Text, Button } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { login, request, setSessionId, message } from '../../lib/api';
import { defaultSessionTitle } from '@pengtou/shared';
export default function Start() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const id = useRef('');
  const lock = useRef(false);
  async function organize() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    id.current ||= 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(
      /[xy]/g,
      (c) => {
        const r = Math.floor(Math.random() * 16);
        return (c === 'x' ? r : (r & 3) | 8).toString(16);
      },
    );
    try {
      await login();
      await request('/sessions', 'POST', {
        id: id.current,
        title: defaultSessionTitle(new Date()),
        participantVisibility: 'everyone',
      });
      setSessionId(id.current);
      await Taro.redirectTo({ url: `/pages/session/index?sid=${id.current}` });
    } catch (e) {
      setError(message(e));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <View className="page">
      <Text className="title">记录一场活动</Text>
      <Text className="subtitle">这一次，你以什么身份记录？</Text>
      <View className="list-group">
        <Button
          className="row-button choice-row"
          disabled={busy}
          onClick={() => void organize()}
        >
          <Text className="row-title">我是发起人</Text>
          <Text className="hint">直接记录，加入码会显示在下方</Text>
        </Button>
        <Button
          className="row-button choice-row"
          disabled={busy}
          onClick={() =>
            Taro.redirectTo({ url: '/pages/activity/edit?role=participant' })
          }
        >
          <Text className="row-title">我是参与者</Text>
          <Text className="hint">直接留下自己的见闻和心得</Text>
        </Button>
      </View>
      {error && <Text className="hint">{error}</Text>}
    </View>
  );
}
