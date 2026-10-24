import { useState, useRef } from 'react';
import { View, Text, Input, Button, Switch } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { login, request, message, setSessionId } from '../../lib/api';
export default function Create() {
  const stableId = useRef('');
  const lock = useRef(false);
  const newId = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.floor(Math.random() * 16);
      return (c === 'x' ? r : (r & 3) | 8).toString(16);
    });
  };
  const [title, setTitle] = useState('');
  const [privatePeople, setPrivate] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function save() {
    if (busy || lock.current) return;
    lock.current = true;
    stableId.current ||= newId();
    const id = stableId.current;
    setBusy(true);
    try {
      await login();
      await request('/sessions', 'POST', {
        id,
        title,
        participantVisibility: privatePeople ? 'organizer_only' : 'everyone',
      });
      setSessionId(id);
      await Taro.redirectTo({ url: `/pages/session/index?sid=${id}` });
    } catch (e) {
      setError(message(e));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <View className="page">
      <Text className="title">发起活动</Text>
      <View className="card">
        <Input
          className="field"
          placeholder="这场叫什么？"
          value={title}
          maxlength={120}
          onInput={(e) => setTitle(e.detail.value)}
        />
        <Text>
          仅发起者能看参与者资料{' '}
          <Switch
            checked={privatePeople}
            onChange={(e) => setPrivate(e.detail.value)}
          />
        </Text>
        <Text className="hint">不打开时，本场参与者互相可见。</Text>
      </View>
      {error && <Text>{error}</Text>}
      <Button
        className="button"
        disabled={busy || !title.trim()}
        onClick={() => void save()}
      >
        创建并邀请大家
      </Button>
    </View>
  );
}
