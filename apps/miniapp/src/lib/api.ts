import Taro from '@tarojs/taro';
import { getRuntimePlatform, resolveApiBase } from './api-base';
const runtimePlatform = getRuntimePlatform();
const apiBase = resolveApiBase(runtimePlatform);
const devAuth = runtimePlatform === 'devtools';
// 原小程序仍使用同一 AppID：首次读取时复制旧存储键，避免改名丢失身份和当前活动。
function readStorage(key: string): string {
  const current = Taro.getStorageSync<string>(key);
  if (current) return current;
  const legacy = Taro.getStorageSync<string>(
    key.replace(/^qinggairugu\./, 'pengtou.'),
  );
  if (legacy) {
    Taro.setStorageSync(key, legacy);
    Taro.removeStorageSync(key.replace(/^qinggairugu\./, 'pengtou.'));
  }
  return legacy || '';
}
// 开发身份与真实微信登录凭证隔离，切换构建后必须重新建立正确身份。
const tokenKey = devAuth ? 'qinggairugu.devToken' : 'qinggairugu.wechatToken';
export function currentSessionId() {
  return readStorage('qinggairugu.session') || '';
}
export function setSessionId(id: string) {
  Taro.setStorageSync('qinggairugu.session', id);
}
export async function request<T>(
  path: string,
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' = 'GET',
  data?: unknown,
  retry = true,
): Promise<T> {
  const token = readStorage(tokenKey);
  const response = await Taro.request<{ error?: string }>({
    url: apiBase + path,
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
  if (readStorage(tokenKey)) return Promise.resolve();
  loginPromise ??= (async () => {
    let code: string;
    if (devAuth) {
      let identity = readStorage('qinggairugu.devIdentity');
      if (!identity) {
        identity = `dev:${Date.now()}-${Math.random().toString(36).slice(2)}`;
        Taro.setStorageSync('qinggairugu.devIdentity', identity);
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
