import { SessionNav } from '../../components/session-nav';
import { sessionIdFromRoute } from '../../lib/session-route';
import { View, Text, Button } from '@tarojs/components';
import Taro, { useLoad } from '@tarojs/taro';
import { useState } from 'react';
import { currentSessionId, request, message, login } from '../../lib/api';
export default function Personal() {
  const [session, setSession] = useState({
    id: '',
    title: '',
    isMember: false,
    isOrganizer: false,
  });
  const [error, setError] = useState('');
  const [more, setMore] = useState(false);
  useLoad((options) => {
    const id = sessionIdFromRoute(options, currentSessionId());
    void login()
      .then(() => request<typeof session>(`/sessions/${id}`))
      .then(setSession)
      .catch((e) => setError(message(e)));
  });
  return (
    <View className="page">
      <SessionNav active="people" />
      <Text className="hint">以下内容只有你自己可见</Text>
      <View className="list-group">
        <Button
          className="row-button settings-row"
          onClick={() =>
            Taro.navigateTo({ url: '/pages/activity/edit?sid=' + session.id })
          }
        >
          写我的心得 <Text className="chevron">›</Text>
        </Button>
        <Button
          className="row-button settings-row"
          onClick={() =>
            Taro.navigateTo({
              url: '/pages/activity/results?sid=' + session.id,
            })
          }
        >
          查看我的整理结果 <Text className="chevron">›</Text>
        </Button>
      </View>
      <Button className="row-button text-action" onClick={() => setMore(!more)}>
        更多操作
      </Button>
      {more && (
        <View className="card">
          {session.isOrganizer && (
            <Button
              className="row-button"
              onClick={() =>
                Taro.navigateTo({
                  url: '/pages/activity/create?sid=' + session.id,
                })
              }
            >
              编辑活动名称和时间
            </Button>
          )}{' '}
          {session.isMember && (
            <Button
              className="row-button"
              onClick={() => {
                void request<import('@pengtou/contracts').PersonalEntry[]>(
                  '/me/entries',
                )
                  .then(async (rows) => {
                    const candidates = rows.filter(
                      (e) =>
                        !e.sessionId && e.title.trim() === session.title.trim(),
                    );
                    if (!candidates.length) {
                      setError('没有找到同名的私人记录。可以直接添加心得。');
                      return;
                    }
                    const choice = await Taro.showActionSheet({
                      itemList: candidates
                        .slice(0, 6)
                        .map(
                          (e) => e.title + ' · ' + e.occurredAt.slice(0, 10),
                        ),
                    });
                    const entry = candidates[choice.tapIndex]!;
                    if (
                      !(
                        await Taro.showModal({
                          title: '关联这份私人记录？',
                          content:
                            '只建立活动引用，心得和照片仍只有你可见，不合并、不公开。',
                        })
                      ).confirm
                    )
                      return;
                    await request(`/me/entries/${entry.id}`, 'PATCH', {
                      version: entry.version,
                      sessionId: session.id,
                    });
                    setError('已关联，原心得和照片仍只有你可见。');
                  })
                  .catch((e) => setError(message(e)));
              }}
            >
              关联以前记录过的同场活动
            </Button>
          )}
        </View>
      )}
      {error && <Text className="hint">{error}</Text>}
    </View>
  );
}
