import { sessionIdFromRoute } from '../../lib/session-route';
import { useState, useRef } from 'react';
import { View, Text } from '@tarojs/components';
import { useDidShow, useDidHide, useLoad } from '@tarojs/taro';
import type { Profile } from '@pengtou/contracts';
import { request, currentSessionId, message } from '../../lib/api';
export default function People() {
  const [people, setPeople] = useState<{ id: string; profile: Profile }[]>([]);
  const [error, setError] = useState('');
  const ownSession = useRef('');
  const generation = useRef(0);
  useLoad((options) => {
    try {
      ownSession.current = sessionIdFromRoute(options, currentSessionId());
    } catch (e) {
      setError(message(e));
    }
  });
  useDidHide(() => {
    generation.current++;
    setPeople([]);
  });
  useDidShow(() => {
    const ticket = ++generation.current;
    setPeople([]);
    const id = ownSession.current;
    if (!id) {
      setError('先扫码进入一场见面。');
      return;
    }
    void request<typeof people>(`/sessions/${id}/participants`)
      .then((rows) => {
        if (ticket !== generation.current) return;
        setPeople(rows);
        setError('');
      })
      .catch((e) => {
        if (ticket === generation.current) setError(message(e));
      });
  });
  return (
    <View className="page">
      <Text className="title">都有谁</Text>
      {error && <Text className="subtitle">{error}</Text>}
      {people.map((person) => (
        <View className="card" key={person.id}>
          <Text className="title">{person.profile.name}</Text>
          <Text className="subtitle">{person.profile.introduction}</Text>
          {person.profile.workingOn && (
            <Text>最近在搞：{person.profile.workingOn}</Text>
          )}
          {person.profile.wantToDiscuss && (
            <Text>想聊：{person.profile.wantToDiscuss}</Text>
          )}
          {person.profile.wantToMeet && (
            <Text>想认识：{person.profile.wantToMeet}</Text>
          )}
        </View>
      ))}
    </View>
  );
}
