import { useState, useRef } from 'react';
import { View, Text, Input, Button, Switch, Picker } from '@tarojs/components';
import Taro, { useLoad } from '@tarojs/taro';
import type { CloudSession } from '@pengtou/contracts';
import { login, request, message, setSessionId } from '../../lib/api';
export default function Create() {
  const stableId = useRef('');
  const editing = useRef(false);
  const lock = useRef(false);
  const newId = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.floor(Math.random() * 16);
      return (c === 'x' ? r : (r & 3) | 8).toString(16);
    });
  };
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('14:00');
  const [privatePeople, setPrivate] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useLoad((options) => {
    if (!options.sid) return;
    editing.current = true;
    stableId.current = options.sid;
    void login()
      .then(() => request<CloudSession>(`/sessions/${options.sid}`))
      .then((r) => {
        setTitle(r.title);
        setPrivate(r.participantVisibility === 'organizer_only');
        if (r.startsAt) {
          const d = new Date(r.startsAt);
          setDate(
            `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
          );
          setTime(
            `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
          );
        }
      })
      .catch((e) => setError(message(e)));
  });
  async function save() {
    if (busy || lock.current) return;
    lock.current = true;
    stableId.current ||= newId();
    const id = stableId.current;
    setBusy(true);
    try {
      await login();
      await request(
        editing.current ? `/sessions/${id}` : '/sessions',
        editing.current ? 'PATCH' : 'POST',
        {
          ...(editing.current ? {} : { id }),
          title,
          startsAt: date
            ? new Date(date + 'T' + time + ':00').toISOString()
            : null,
          participantVisibility: privatePeople ? 'organizer_only' : 'everyone',
        },
      );
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
      <Text className="role-badge">我是发起人</Text>
      <Text className="title">创建一场活动</Text>
      <View className="card">
        <Input
          className="field"
          placeholder="这场叫什么？"
          value={title}
          maxlength={120}
          onInput={(e) => setTitle(e.detail.value)}
        />
        <Picker
          mode="date"
          value={date}
          onChange={(e) => setDate(e.detail.value)}
        >
          <View className="settings-row">
            <Text>活动日期（可选）</Text>
            <Text>{date || '选择日期'}</Text>
          </View>
        </Picker>
        {date && (
          <Picker
            mode="time"
            value={time}
            onChange={(e) => setTime(e.detail.value)}
          >
            <View className="settings-row">
              <Text>时间</Text>
              <Text>{time}</Text>
            </View>
          </Picker>
        )}
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
        className="row-button button"
        disabled={busy || !title.trim()}
        onClick={() => void save()}
      >
        {editing.current ? '保存活动信息' : '创建并邀请大家'}
      </Button>
    </View>
  );
}
