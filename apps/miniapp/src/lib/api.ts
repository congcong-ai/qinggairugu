import Taro from '@tarojs/taro';
declare const API_BASE: string;
declare const DEV_AUTH: boolean;
// 开发身份与真实微信登录凭证隔离，切换构建后必须重新建立正确身份。
const tokenKey = DEV_AUTH ? 'pengtou.devToken' : 'pengtou.wechatToken';
export function currentSessionId() {
  return Taro.getStorageSync<string>('pengtou.session') || '';
}
export function setSessionId(id: string) {
  Taro.setStorageSync('pengtou.session', id);
}
export async function request<T>(
  path: string,
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' = 'GET',
  data?: unknown,
  retry = true,
): Promise<T> {
  const token = Taro.getStorageSync<string>(tokenKey);
  const response = await Taro.request<{ error?: string }>({
    url: API_BASE + path,
    method,
    data,
    header: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  if (response.statusCode === 401) {
    Taro.removeStorageSync(tokenKey);
    if (retry && path !== '/auth/wechat') {
      await login();
      return request<T>(path, method, data, false);
    }
  }
  if (response.statusCode >= 400)
    throw new Error(response.data.error || '暂时无法连接，请稍后重试');
  return response.data as T;
}
let loginPromise: Promise<void> | undefined;
export function login() {
  if (Taro.getStorageSync(tokenKey)) return Promise.resolve();
  loginPromise ??= (async () => {
    let code: string;
    if (DEV_AUTH) {
      let identity = Taro.getStorageSync<string>('pengtou.devIdentity');
      if (!identity) {
        identity = `dev:${Date.now()}-${Math.random().toString(36).slice(2)}`;
        Taro.setStorageSync('pengtou.devIdentity', identity);
      }
      code = identity;
    } else code = (await Taro.login()).code;
    const auth = await request<{ token: string }>('/auth/wechat', 'POST', {
      code,
    });
    Taro.setStorageSync(tokenKey, auth.token);
  })().finally(() => {
    loginPromise = undefined;
  });
  return loginPromise;
}
export function message(error: unknown) {
  return error instanceof Error ? error.message : '操作未完成，请重试';
}
