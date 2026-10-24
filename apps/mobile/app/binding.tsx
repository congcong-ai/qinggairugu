import { useState, useEffect } from 'react';
import { Text, Alert } from 'react-native';
import { Page, Heading, Card, Action, styles } from '../src/ui';
import { bindingStatus, cloudRequest, clearBoundCache } from '../src/cloud';
export default function Binding() {
  const [state, setState] = useState<Awaited<
    ReturnType<typeof bindingStatus>
  > | null>(null);
  const [challenge, setChallenge] = useState<{
    id: string;
    code: string;
    expiresAt: string;
  } | null>(null);
  const [claim, setClaim] = useState<{
    claimed: boolean;
    displayName: string;
    identityHint: string;
    expired: boolean;
    consumed: boolean;
  } | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const load = () =>
    bindingStatus()
      .then(setState)
      .catch((e) => setError(e.message));
  useEffect(() => {
    void load();
  }, []);
  useEffect(() => {
    if (!challenge) return;
    const poll = () =>
      cloudRequest<typeof claim>(`/bindings/challenges/${challenge.id}`)
        .then(setClaim)
        .catch((e) => setError(e.message));
    void poll();
    const t = setInterval(() => void poll(), 3000);
    return () => clearInterval(t);
  }, [challenge]);
  async function create() {
    setBusy(true);
    try {
      const next = await cloudRequest<{
        id: string;
        code: string;
        expiresAt: string;
      }>('/bindings/challenges', 'POST', {});
      setChallenge(next);
      setClaim(null);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : '未完成');
    } finally {
      setBusy(false);
    }
  }
  async function confirm() {
    setBusy(true);
    try {
      await cloudRequest(
        `/bindings/challenges/${challenge!.id}/confirm`,
        'POST',
        { confirm: true },
      );
      await clearBoundCache();
      setChallenge(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '未完成');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Page>
      <Heading
        title="关联我的小程序"
        subtitle="录音留在这里，选择同步的文字在那里看。"
      />
      {state?.bindings.map((b) => (
        <Card key={b.id}>
          <Text style={styles.label}>
            已关联微信身份 · {state.userId?.slice(-6)}
          </Text>
          <Action
            secondary
            label="解除关联"
            onPress={() =>
              Alert.alert(
                '解除关联？',
                '删除此绑定的私有 AI 云端副本。本机原件及小程序独立心得保留。',
                [
                  { text: '取消', style: 'cancel' },
                  {
                    text: '解除',
                    style: 'destructive',
                    onPress: () => {
                      void cloudRequest(`/bindings/${b.id}`, 'DELETE')
                        .then(clearBoundCache)
                        .then(load)
                        .catch((e) => setError(e.message));
                    },
                  },
                ],
              )
            }
          />
        </Card>
      ))}
      {!state?.bindings.length && (
        <Action
          label="获取一次性关联码"
          disabled={busy}
          onPress={() => void create()}
        />
      )}
      {challenge && (
        <Card>
          <Text style={styles.caption}>
            打开小程序 → 我的 → 关联我的 App，输入下方关联码。有效期 5 分钟。
          </Text>
          <Text selectable style={{ fontSize: 30, letterSpacing: 3 }}>
            {challenge.code}
          </Text>
          <Text style={styles.caption}>
            {claim?.expired
              ? '已过期，请重新获取'
              : claim?.claimed
                ? `待确认：${claim.displayName} · ${claim.identityHint}`
                : '等待微信确认'}
          </Text>
          {claim?.claimed && !claim.expired && !claim.consumed && (
            <Action
              label="核对无误，关联此微信"
              disabled={busy}
              onPress={() =>
                Alert.alert(
                  '确认关联此微信？',
                  '此微信可查看本设备创建的云端活动；私人 AI 仍需另行主动同步。',
                  [
                    { text: '取消', style: 'cancel' },
                    { text: '确认', onPress: () => void confirm() },
                  ],
                )
              }
            />
          )}
        </Card>
      )}
      {!!error && <Text style={styles.caption}>{error}</Text>}
    </Page>
  );
}
