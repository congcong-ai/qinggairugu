import { useEffect, useState } from 'react';
import { Alert, Platform, Switch, Text } from 'react-native';
import { router } from 'expo-router';
import { Page, Heading, Card, Action, styles } from '../src/ui';
import { readAccount, storageScope, type Account } from '../src/account-store';
import { loginWithWechat, logoutAccount } from '../src/account-actions';
import { useRecording } from '../src/recording-context';
import { getDatabase } from '../src/storage/database';
export default function AccountScreen() {
  const [account, setAccount] = useState<Account | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [count, setCount] = useState(0);
  const [claim, setClaim] = useState(false);
  const [canClaim, setCanClaim] = useState(false);
  const recording = useRecording();
  useEffect(() => {
    void storageScope(null).then((scope) => setCanClaim(scope === 'legacy'));
    void readAccount()
      .then(setAccount)
      .catch(() => setError('账号读取失败'));
    void getDatabase()
      .then((db) =>
        db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM sessions'),
      )
      .then((row) => setCount(row?.n ?? 0));
  }, []);
  const login = async () => {
    setBusy(true);
    setError('');
    try {
      const a = await loginWithWechat(claim);
      Alert.alert(
        '微信登录成功',
        a.crossPlatformReady
          ? '已建立账号。登录不会自动同步私人内容。'
          : '已建立账号，但尚未确认与小程序为同一身份，暂不能认定跨端已打通。',
      );
      router.replace('/');
    } catch (e) {
      setError(e instanceof Error ? e.message : '登录未完成');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Page>
      <Heading
        title="我的账号"
        subtitle="需要两端连接时再登录，本机记录随时可用。"
      />
      <Card>
        <Text style={styles.body}>
          {account ? '已微信登录' : '当前免登录使用'}
        </Text>
        <Text style={styles.caption}>
          录音、照片和百炼Key不上传。私人文字需另行选择同步，完整转写默认不选；发布共享回顾另行确认。
        </Text>
      </Card>
      {!account && Platform.OS !== 'android' && (
        <Card>
          <Text style={styles.body}>
            微信登录暂未开放，你可以继续免登录记录，内容保存在当前手机。
          </Text>
        </Card>
      )}
      {!account && Platform.OS === 'android' && (
        <>
          <Card>
            <Text style={styles.body}>
              当前本机空间共有 {count}{' '}
              条记录。默认保留在免登录空间，登录后进入独立账号空间。
            </Text>
            <Text style={styles.caption}>
              认领会将当前未归属历史整体归到本次微信账号，仅改变本机归属，不上传文字和媒体。认领后退出不会显示这些账号记录；再次登录本人账号才能查看。已有其他账号归属不能再次认领。
            </Text>
            <Text style={styles.label}>将未归属历史认领给本次微信账号</Text>
            <Switch
              value={claim}
              onValueChange={setClaim}
              disabled={busy || !canClaim}
            />
          </Card>
          <Action
            label={busy ? '正在连接微信…' : '微信登录'}
            disabled={busy || recording.busy || !!recording.active}
            onPress={() => void login()}
          />
        </>
      )}
      {account && (
        <Action
          secondary
          label="退出登录"
          disabled={busy || recording.busy || !!recording.active}
          onPress={() =>
            Alert.alert(
              '退出登录？',
              '本机媒体保留，账号记录退出后隐藏；回到免登录空间。',
              [
                { text: '取消', style: 'cancel' },
                {
                  text: '退出',
                  onPress: () => {
                    setBusy(true);
                    void logoutAccount()
                      .then((r) => {
                        if (!r.revoked)
                          Alert.alert(
                            '已退出本机账号',
                            '网络不可用，服务端令牌撤销未确认，旧令牌按有效期到期。',
                          );
                        router.replace('/');
                      })
                      .catch((e) => setError(e.message))
                      .finally(() => setBusy(false));
                  },
                },
              ],
            )
          }
        />
      )}
      {!!error && <Text style={styles.body}>{error}</Text>}
      <Action secondary label="返回我的" onPress={() => router.back()} />
    </Page>
  );
}
