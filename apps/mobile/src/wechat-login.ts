import { NativeModules, Platform } from 'react-native';
const appId = 'wx2f97ade32e73a58b';
// 只返回服务端验证结果；由账号流程确认归属并安全保存产品令牌。
export async function authorizeWechat() {
  if (Platform.OS !== 'android') throw new Error('当前仅支持Android微信登录');
  const native = NativeModules.QinggaiWechat as
    { authorize?: (appId: string) => Promise<string> } | undefined;
  if (!native?.authorize) throw new Error('请安装包含微信登录模块的新版本App');
  const code = await native.authorize(appId);
  if (!code || code.length > 256) throw new Error('微信授权码无效，请重试');
  const base = process.env.EXPO_PUBLIC_API_URL || 'http://10.0.2.2:9001';
  if (!__DEV__ && !base.startsWith('https://'))
    throw new Error('正式环境需要HTTPS');
  const response = await fetch(base + '/auth/wechat/mobile', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ code }),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok)
    throw new Error(
      response.status === 409
        ? '两个已有账号需要单独核验，不能自动合并'
        : '微信登录暂不可用，请稍后重试',
    );
  const result = (await response.json()) as {
    token?: unknown;
    userId?: unknown;
    crossPlatformReady?: unknown;
  };
  if (
    typeof result.token !== 'string' ||
    !/^[a-f0-9]{64}$/.test(result.token) ||
    typeof result.userId !== 'string' ||
    !/^[a-f0-9-]{36}$/.test(result.userId) ||
    typeof result.crossPlatformReady !== 'boolean'
  )
    throw new Error('登录响应无效，请重试');
  return {
    token: result.token,
    userId: result.userId,
    crossPlatformReady: result.crossPlatformReady,
  };
}
