import { usePageShare } from '../../lib/use-page-share';
import { SessionNote } from '../../components/session-note';
import { SessionNav } from '../../components/session-nav';
import { sessionIdFromRoute } from '../../lib/session-route';
import { useState, useRef } from 'react';
import { View, Text, Button, Image, ScrollView } from '@tarojs/components';
import Taro, { useLoad, useDidShow, useDidHide, useUnload } from '@tarojs/taro';
import type { CloudSession, Profile } from '@qinggairugu/contracts';
import {
  currentSessionId,
  setSessionId,
  request,
  message,
  login,
} from '../../lib/api';
type SessionInfo = CloudSession & {
  isOrganizer: boolean;
  isMember: boolean;
  archived: boolean;
};
type Participant = { id: string; profile: Profile };
const profileFields: [keyof Profile, string][] = [
  ['introduction', '一句话介绍'],
  ['workingOn', '最近在搞什么'],
  ['wantToDiscuss', '今天想聊什么'],
  ['wantToMeet', '想认识什么样的人'],
  ['canDiscuss', '可以找我聊什么'],
  ['organization', '公司 / 组织'],
  ['occupation', '职业'],
  ['city', '城市'],
  ['publicLink', '公开账号链接'],
];
export default function SessionPage() {
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [people, setPeople] = useState<Participant[]>([]);
  const [selectedPerson, setSelectedPerson] = useState<Participant | null>(
    null,
  );
  const [peopleError, setPeopleError] = useState('');
  const [error, setError] = useState('');
  const [qr, setQr] = useState('');
  const [qrError, setQrError] = useState('');
  const ownSession = useRef('');
  usePageShare(() => ({ id: ownSession.current, title: session?.title }));
  const generation = useRef(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  async function refresh() {
    const id = ownSession.current;
    if (!id) return;
    const ticket = ++generation.current;
    const live = () => ticket === generation.current;
    try {
      await login();
      const info = await request<SessionInfo>(`/sessions/${id}`);
      if (!live()) return;
      setSession(info);
      setError('');
      setSessionId(id);
      if (info.isOrganizer) {
        void request<{ imageDataUrl: string }>(`/sessions/${id}/qr`)
          .then((r) => {
            if (!live()) return;
            const path =
              Taro.env.USER_DATA_PATH + '/qinggai-join-' + id + '.png';
            Taro.getFileSystemManager().writeFileSync(
              path,
              r.imageDataUrl.split(',')[1]!,
              'base64',
            );
            setQr(path);
            setQrError('');
          })
          .catch((e) => {
            if (live()) setQrError(message(e));
          });
      }
      if (info.isOrganizer || info.isMember) {
        void request<typeof people>(`/sessions/${id}/participants`)
          .then((rows) => {
            if (live()) {
              setPeople(rows);
              setPeopleError('');
            }
          })
          .catch((e) => {
            if (live()) {
              setPeople([]);
              setSelectedPerson(null);
              setPeopleError(message(e));
            }
          });
      } else {
        setPeople([]);
        setPeopleError('加入后，按本场设置查看参与者。');
      }
    } catch (e) {
      if (live()) {
        setSession(null);
        setPeople([]);
        setQr('');
        setError(message(e));
      }
    }
  }
  useLoad((options) => {
    try {
      ownSession.current = sessionIdFromRoute(options, currentSessionId());
    } catch (e) {
      setError(message(e));
    }
  });
  useDidShow(() => {
    void refresh();
    if (timer.current) clearInterval(timer.current);
    timer.current = setInterval(() => void refresh(), 15000);
  });
  useUnload(() => {
    generation.current++;
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  });
  useDidHide(() => {
    generation.current++;
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    setPeople([]);
    setSelectedPerson(null);
    setQr('');
  });
  return (
    <View className="page">
      <SessionNav active="index" />
      {error && (
        <View className="inline-state">
          <Text>{error}</Text>
          <Button
            className="row-button text-action"
            onClick={() => void refresh()}
          >
            重新加载
          </Button>
        </View>
      )}
      {session && (session.isOrganizer || session.isMember) && (
        <SessionNote key={session.id} sid={session.id} title={session.title} />
      )}
      {session?.isOrganizer && (
        <View className="card join-code-card">
          <Text className="row-title">邀请大家加入</Text>
          {qr ? (
            <Image className="join-code" src={qr} mode="aspectFit" />
          ) : (
            <Text className="hint">{qrError || '正在加载加入码…'}</Text>
          )}
          <Text className="hint">微信扫一扫，加入这场活动</Text>
          {qrError && (
            <Button
              className="row-button text-action"
              onClick={() => void refresh()}
            >
              重试加载
            </Button>
          )}
        </View>
      )}
      {session && (
        <Button className="row-button button" openType="share">
          分享这场给朋友
        </Button>
      )}
      {session && !session.isOrganizer && !session.isMember && (
        <Button
          className="row-button button"
          onClick={() =>
            Taro.navigateTo({ url: '/pages/profile/edit?sid=' + session.id })
          }
        >
          加入这场
        </Button>
      )}
      {session?.isMember && !session.isOrganizer && (
        <Text className="hint">你已加入这场，切换「我的记录」留下心得。</Text>
      )}
      {session && !session.isOrganizer && !session.isMember && (
        <Text className="hint">
          加入这场后，就能点开查看本场其他参与者的「关于我」。
        </Text>
      )}
      {session && (
        <>
          <View className="page-heading">
            <Text className="row-title">
              已加入 · {session.participantCount} 人
            </Text>
            <Button
              className="row-button scan-action"
              onClick={() => void refresh()}
            >
              刷新
            </Button>
          </View>
          {peopleError && <Text className="hint">{peopleError}</Text>}
          {!peopleError && !people.length && (
            <Text className="hint">还没有人加入，扫码后会直接显示在这里。</Text>
          )}
          {!!people.length && (
            <View className="list-group">
              {people.map((person) => (
                <Button
                  className="participant-row participant-row-button"
                  key={person.id}
                  aria-label={`查看${person.profile.name}的关于我`}
                  onClick={() => setSelectedPerson(person)}
                >
                  <View className="person-avatar">
                    {person.profile.name.slice(0, 1)}
                  </View>
                  <View className="row-content">
                    <Text className="row-title">{person.profile.name}</Text>
                    <Text className="hint">{person.profile.introduction}</Text>
                  </View>
                  <Text className="participant-more">查看详情 ›</Text>
                </Button>
              ))}
            </View>
          )}
          <Text className="hint">
            {session.participantVisibility === 'everyone'
              ? '点开参与者，可以查看完整的「关于我」。'
              : '参与者资料仅发起人可见。'}
          </Text>
        </>
      )}
      {selectedPerson && (
        <View className="profile-detail-mask">
          <View className="profile-detail-sheet">
            <View className="profile-detail-heading">
              <View className="person-avatar profile-detail-avatar">
                {selectedPerson.profile.name.slice(0, 1)}
              </View>
              <View className="profile-detail-name">
                <Text className="row-title">{selectedPerson.profile.name}</Text>
                <Text className="hint">本场参与者的「关于我」</Text>
              </View>
            </View>
            <ScrollView
              className="profile-detail-scroll"
              scrollY
              enhanced
              showScrollbar={false}
            >
              {profileFields.map(([key, label]) => {
                const value = selectedPerson.profile[key];
                if (typeof value !== 'string' || !value.trim()) return null;
                return (
                  <View className="profile-detail-field" key={key}>
                    <Text className="profile-detail-label">{label}</Text>
                    <Text className="profile-detail-value">{value}</Text>
                  </View>
                );
              })}
            </ScrollView>
            <Button
              className="row-button button profile-detail-close"
              onClick={() => setSelectedPerson(null)}
            >
              关闭
            </Button>
          </View>
        </View>
      )}
    </View>
  );
}
