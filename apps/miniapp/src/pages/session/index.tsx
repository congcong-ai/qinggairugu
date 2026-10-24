import { sessionIdFromRoute } from '../../lib/session-route';
import { AppGuide } from '../../components/app-guide';
import { useState, useRef } from 'react';
import { View, Text, Button, Input, Image } from '@tarojs/components';
import Taro, { useLoad, useDidShow, useDidHide } from '@tarojs/taro';
import type { CloudSession } from '@pengtou/contracts';
import {
  currentSessionId,
  setSessionId,
  request,
  message,
  login,
} from '../../lib/api';
export default function SessionPage() {
  const [session, setSession] = useState<
    | (CloudSession & {
        isOrganizer: boolean;
        isMember: boolean;
        archived: boolean;
      })
    | null
  >(null);
  const [error, setError] = useState('');
  const ownSession = useRef('');
  const generation = useRef(0);
  const [qr, setQr] = useState('');
  const [input, setInput] = useState('');
  const refresh = () => {
    const id = ownSession.current;
    const ticket = ++generation.current;
    if (id) {
      setSessionId(id);
      setQr('');
      void login()
        .then(() =>
          request<
            CloudSession & {
              isOrganizer: boolean;
              isMember: boolean;
              archived: boolean;
            }
          >(`/sessions/${id}`),
        )
        .then((result) => {
          if (ticket === generation.current) {
            setSession(result);
            setError('');
          }
        })
        .catch((e) => {
          if (ticket === generation.current) {
            setSession(null);
            setError(message(e));
          }
        });
    }
  };
  useLoad((options) => {
    try {
      ownSession.current = sessionIdFromRoute(options, currentSessionId());
    } catch (e) {
      setError(message(e));
      return;
    }
    refresh();
  });
  useDidShow(refresh);
  useDidHide(() => {
    generation.current++;
    setQr('');
  });
  return (
    <View className="page">
      <Text className="eyebrow">倾盖如故 · 每次相聚，都算数</Text>
      <View className="hero">
        <Text className="title">{session?.title || '很高兴在这里遇见你'}</Text>
        <Text className="subtitle">
          {session
            ? `已有 ${session.participantCount} 人在这里`
            : '去「我的活动」独立记一次相聚，也可以扫码加入。'}
        </Text>
        {session && (
          <Button
            className="button"
            onClick={() =>
              Taro.navigateTo({ url: '/pages/profile/edit?sid=' + session.id })
            }
          >
            {session.isMember ? '修改本场关于我' : '加入这场'}
          </Button>
        )}
      </View>
      {!session && process.env.NODE_ENV !== 'production' && (
        <View className="card">
          <Input
            placeholder="开发调试：输入 Session 编号"
            value={input}
            onInput={(e) => setInput(e.detail.value)}
          />
          <Button
            onClick={() => {
              try {
                ownSession.current = sessionIdFromRoute({ sid: input.trim() });
                refresh();
              } catch (e) {
                setError(message(e));
              }
            }}
          >
            打开这场
          </Button>
        </View>
      )}
      {session && (
        <View className="card">
          <Button
            onClick={() =>
              Taro.navigateTo({
                url: '/pages/session/people?sid=' + session.id,
              })
            }
          >
            都有谁
          </Button>
          <Button
            onClick={() =>
              Taro.navigateTo({ url: '/pages/session/recap?sid=' + session.id })
            }
          >
            这场回顾（本场共享）
          </Button>
          <Button
            onClick={() =>
              Taro.navigateTo({ url: '/pages/activity/edit?sid=' + session.id })
            }
          >
            添加我的心得（只有我可见）
          </Button>
          <Button
            onClick={() =>
              Taro.navigateTo({
                url: '/pages/activity/results?sid=' + session.id,
              })
            }
          >
            我的整理结果（只有我可见）
          </Button>
          {session.isOrganizer && (
            <Button
              onClick={() => {
                const ticket = generation.current;
                void request<{ imageDataUrl: string }>(
                  `/sessions/${session.id}/qr`,
                )
                  .then((r) => {
                    if (ticket !== generation.current) return;
                    const path =
                      Taro.env.USER_DATA_PATH +
                      '/qinggai-join-' +
                      session.id +
                      '.png';
                    Taro.getFileSystemManager().writeFileSync(
                      path,
                      r.imageDataUrl.split(',')[1]!,
                      'base64',
                    );
                    setQr(path);
                  })
                  .catch((e) => setError(message(e)));
              }}
            >
              分享这场 · 生成加入码
            </Button>
          )}
          {!!qr && <Image src={qr} mode="widthFix" style={{ width: '100%' }} />}
          {session.isMember && (
            <Button
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
          <Text className="hint">
            录音、导入和 AI 整理请在 App 中继续记录。
          </Text>
        </View>
      )}
      {error && <Text className="hint">{error}</Text>}
      {session && (
        <View className="card">
          <Text className="hint">
            {session.participantVisibility === 'everyone'
              ? '本场参与者可以互相查看「关于我」。'
              : '你的资料仅主办方可见。'}
          </Text>
        </View>
      )}
      <AppGuide />
    </View>
  );
}
