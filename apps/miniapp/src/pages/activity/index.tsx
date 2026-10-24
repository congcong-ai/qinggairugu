import { AppGuide } from '../../components/app-guide';
import { useState } from 'react';
import { View, Text, Button } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import type { ActivityItem } from '@pengtou/contracts';
import { login, request, message, setSessionId } from '../../lib/api';
export default function Activities() {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [next, setNext] = useState<number | null>(null);
  const [error, setError] = useState('');
  async function load(offset = 0) {
    try {
      await login();
      const data = await request<{
        items: ActivityItem[];
        nextOffset: number | null;
      }>(`/me/activities?offset=${offset}`);
      setItems((old) => (offset ? [...old, ...data.items] : data.items));
      setNext(data.nextOffset);
      setError('');
    } catch (e) {
      setError(message(e));
    }
  }
  useDidShow(() => {
    void load();
  });
  async function scan() {
    try {
      const r = await Taro.scanCode({ scanType: ['qrCode'] });
      const id = r.result.match(/[0-9a-f]{8}-[0-9a-f-]{27}/i)?.[0];
      if (r.path) {
        await Taro.navigateTo({ url: '/' + r.path.replace(/^\//, '') });
        return;
      }
      if (!id) throw new Error('请扫描本场活动的小程序码');
      setSessionId(id);
      await Taro.navigateTo({ url: `/pages/session/index?sid=${id}` });
    } catch (e) {
      setError(message(e));
    }
  }
  return (
    <View className="page">
      <Text className="eyebrow">倾盖如故 · 每次相聚，都算数</Text>
      <Text className="title">我的活动</Text>
      <View className="hero">
        <Text className="subtitle">不等邀请，也能把今天留下来。</Text>
        <Button
          className="button"
          onClick={() => Taro.navigateTo({ url: '/pages/activity/edit' })}
        >
          记一次活动
        </Button>
        <Button
          onClick={() => Taro.navigateTo({ url: '/pages/activity/create' })}
        >
          发起活动
        </Button>
        <Button onClick={() => void scan()}>扫码加入</Button>
      </View>
      {error && <Text className="hint">{error}</Text>}
      {!items.length && (
        <Text className="subtitle">从一次相聚、一段心得开始。</Text>
      )}
      {items.map((item) => (
        <View className="card" key={item.id}>
          <Text className="title">{item.title}</Text>
          <Text className="hint">
            {new Date(item.occurredAt).toLocaleDateString()} ·{' '}
            {
              {
                organizer: '我发起的',
                participant: '我参加的',
                private: '私人记录',
              }[item.relation]
            }
          </Text>
          <Button
            onClick={() => {
              if (item.sessionId) {
                setSessionId(item.sessionId);
                void Taro.navigateTo({
                  url: `/pages/session/index?sid=${item.sessionId}`,
                });
              } else if (item.entryIds[0])
                void Taro.navigateTo({
                  url: `/pages/activity/edit?id=${item.entryIds[0]}`,
                });
              else
                void Taro.navigateTo({
                  url: `/pages/activity/results?localId=${item.id}`,
                });
            }}
          >
            打开看看
          </Button>
          {item.entryIds.map((id) => (
            <Button
              key={id}
              onClick={() =>
                Taro.navigateTo({ url: `/pages/activity/edit?id=${id}` })
              }
            >
              我的心得（只有我可见）
            </Button>
          ))}
        </View>
      ))}
      {next !== null && (
        <Button onClick={() => void load(next)}>再看看之前的</Button>
      )}
      <Button
        onClick={() => Taro.navigateTo({ url: '/pages/activity/results' })}
      >
        我的整理结果（只有我可见）
      </Button>
      <AppGuide />
    </View>
  );
}
