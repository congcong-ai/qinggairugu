import { View, Button, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { sessionIdFromRoute } from '../lib/session-route';
import { useState, useRef } from 'react';
import { useDidShow, useDidHide } from '@tarojs/taro';
import type { CloudSession } from '@pengtou/contracts';
import { login, request, message } from '../lib/api';
import { currentSessionId } from '../lib/api';

/** 活动内切换保留页面自己的 sid；不累积重复详情页面。 */
export function SessionNav({
  active,
}: {
  active: 'index' | 'people' | 'recap';
}) {
  const [info, setInfo] = useState<
    (CloudSession & { isOrganizer: boolean; isMember: boolean }) | null
  >(null);
  const [error, setError] = useState('');
  const generation = useRef(0);
  useDidShow(() => {
    const ticket = ++generation.current;
    const pages = Taro.getCurrentPages();
    const sid = sessionIdFromRoute(
      pages[pages.length - 1]?.options ?? {},
      currentSessionId(),
    );
    void login()
      .then(() =>
        request<CloudSession & { isOrganizer: boolean; isMember: boolean }>(
          `/sessions/${sid}`,
        ),
      )
      .then((r) => {
        if (ticket === generation.current) {
          setInfo(r);
          setError('');
        }
      })
      .catch((e) => {
        if (ticket === generation.current) setError(message(e));
      });
  });
  useDidHide(() => {
    generation.current++;
    setInfo(null);
  });
  function open(page: string) {
    const pages = Taro.getCurrentPages();
    const options = pages[pages.length - 1]?.options;
    const sid = sessionIdFromRoute(options ?? {}, currentSessionId());
    if (!sid || page === active) return;
    void Taro.redirectTo({
      url: `/pages/session/${page}?sid=${encodeURIComponent(sid)}`,
    });
  }
  return (
    <View className="session-context">
      {info ? (
        <View className="session-heading">
          <Text className="role-badge">
            {info.isOrganizer
              ? '我是发起人'
              : info.isMember
                ? '我是参与者'
                : '尚未加入'}
          </Text>
          <Text className="row-title">{info.title}</Text>
          <Text className="hint">
            {info.startsAt
              ? new Date(info.startsAt).toLocaleString('zh-CN')
              : '活动时间未设置'}
          </Text>
        </View>
      ) : (
        <Text className="hint">{error || '正在读取这场活动…'}</Text>
      )}
      <View className="session-nav">
        {(
          [
            ['index', '这场'],
            ['people', '我的记录'],
            ['recap', '回顾'],
          ] as const
        ).map(([page, label]) => (
          <Button
            key={page}
            id={`session-nav-${page}`}
            className={active === page ? 'row-button selected' : 'row-button'}
            onClick={() => open(page)}
          >
            {label}
          </Button>
        ))}
      </View>
    </View>
  );
}
