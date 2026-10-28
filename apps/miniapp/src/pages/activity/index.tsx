import { useState } from 'react';
import { View, Text, Button } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import type { ActivityItem } from '@pengtou/contracts';
import { login, request, message, setSessionId } from '../../lib/api';
export default function Activities() {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [next, setNext] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
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
    } finally {
      setLoading(false);
    }
  }
  useDidShow(() => {
    void load();
  });
  async function open(item: ActivityItem) {
    // 列表只保留一个入口，多份已有心得在点击后选择，避免隐藏历史记录。
    if (item.entryIds.length && (item.sessionId || item.entryIds.length > 1)) {
      try {
        let offset = 0;
        while (true) {
          const entries = item.entryIds.slice(offset, offset + 4);
          const options = [
            ...(item.sessionId ? ['查看这场活动'] : []),
            ...entries.map((_, i) => `我的心得 ${offset + i + 1}`),
          ];
          const more = offset + entries.length < item.entryIds.length;
          if (more) options.push('更多心得');
          const choice = await Taro.showActionSheet({ itemList: options });
          if (more && choice.tapIndex === options.length - 1) {
            offset += entries.length;
            continue;
          }
          const entryIndex = choice.tapIndex - (item.sessionId ? 1 : 0);
          if (entryIndex >= 0) {
            await Taro.navigateTo({
              url: `/pages/activity/edit?id=${entries[entryIndex]}`,
            });
            return;
          }
          break;
        }
      } catch {
        return;
      }
    }
    if (item.sessionId) {
      setSessionId(item.sessionId);
      void Taro.navigateTo({
        url: `/pages/session/index?sid=${item.sessionId}`,
      });
    } else if (item.entryIds[0]) {
      void Taro.navigateTo({
        url: `/pages/activity/edit?id=${item.entryIds[0]}`,
      });
    } else {
      void Taro.navigateTo({
        url: `/pages/activity/results?localId=${item.id}`,
      });
    }
  }
  return (
    <View className="page home-page">
      <View className="page-heading">
        <View>
          <Text className="title">我的活动</Text>
          <Text className="heading-note">把每一次见面留下来</Text>
        </View>
      </View>
      <Button
        className="row-button button"
        onClick={() => Taro.navigateTo({ url: '/pages/activity/start' })}
      >
        记录一场活动
      </Button>
      <Text className="section-label">最近活动</Text>
      {error && (
        <View className="inline-state">
          <Text>{error}</Text>
          <Button
            className="row-button text-action"
            onClick={() => void load()}
          >
            重试
          </Button>
        </View>
      )}
      {loading && <Text className="hint">正在读取…</Text>}
      {!loading && !error && !items.length && (
        <View className="empty-state">
          <Text className="empty-title">还没有活动</Text>
          <Text className="hint">写几句心得，或扫一扫加入一场相聚。</Text>
        </View>
      )}
      {!!items.length && (
        <View className="list-group">
          {items.map((item) => (
            <Button
              className="row-button activity-row"
              key={item.id}
              onClick={() => void open(item)}
            >
              <View className="date-tile">
                <Text className="date-day">
                  {new Date(item.occurredAt).getDate()}
                </Text>
                <Text className="date-month">
                  {new Date(item.occurredAt).getMonth() + 1}月
                </Text>
              </View>
              <View className="row-content">
                <Text className="row-title">{item.title}</Text>
                <Text className="hint">
                  {new Date(item.occurredAt).toLocaleDateString('zh-CN')} ·{' '}
                  {
                    {
                      organizer: '我发起的',
                      participant: '我参加的',
                      private: '私人记录',
                    }[item.relation]
                  }
                </Text>
              </View>
              <Text className="chevron">›</Text>
            </Button>
          ))}
        </View>
      )}
      {next !== null && (
        <Button
          className="row-button text-action"
          onClick={() => void load(next)}
        >
          加载更多
        </Button>
      )}
    </View>
  );
}
