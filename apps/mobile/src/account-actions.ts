import * as SecureStore from 'expo-secure-store';
import { authorizeWechat } from './wechat-login';
import { readAccount, saveAccount, claimLegacyAccount } from './account-store';
import { initializeDeviceIdentity, activeCloudRequests } from './cloud';
import { getDatabase } from './storage/database';
import {
  activeAIJobs,
  activeAudioImports,
  activePhotoImports,
  activeSearches,
  setAccountSwitching,
} from './activity';
const base = process.env.EXPO_PUBLIC_API_URL || 'http://10.0.2.2:9001';
let changing = false;
async function idle() {
  if (
    activeAIJobs.size ||
    activeAudioImports.size ||
    activePhotoImports.size ||
    activeSearches.size ||
    activeCloudRequests
  )
    throw new Error('请等待录音、整理、导入和同步完成后再切换账号');
  const db = await getDatabase();
  if (
    await db.getFirstAsync(
      "SELECT id FROM recordings WHERE status IN ('recording','paused') LIMIT 1",
    )
  )
    throw new Error('请先完成录音再切换账号');
}
async function direct(path: string, token: string | null, data?: unknown) {
  if (!__DEV__ && !base.startsWith('https://'))
    throw new Error('正式环境需要HTTPS');
  const r = await fetch(base + path, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    ...(data ? { body: JSON.stringify(data) } : {}),
    signal: AbortSignal.timeout(15000),
  });
  if (!r.ok)
    throw new Error(
      r.status === 409
        ? '历史归属冲突，请保留本机历史并联系支持'
        : '账号服务暂不可用，请稍后重试',
    );
}
export async function loginWithWechat(claimHistory: boolean) {
  if (changing) throw new Error('账号操作正在进行');
  changing = true;
  setAccountSwitching(true);
  let issuedToken: string | null = null;
  try {
    await idle();
    if (await readAccount()) throw new Error('请先退出当前账号');
    const account = await authorizeWechat();
    issuedToken = account.token;
    await idle();
    const owner = await SecureStore.getItemAsync('qinggairugu.legacyOwner');
    const seen = await SecureStore.getItemAsync(
      'qinggairugu.seen.' + account.userId,
    );
    if (claimHistory && (owner || seen))
      throw new Error(
        '已有归属的历史或已有账号空间不能自动合并，请选择暂不认领',
      );
    const scope =
      claimHistory || owner === account.userId
        ? 'legacy'
        : 'account-' + account.userId;
    const device = await initializeDeviceIdentity(scope);
    await direct('/installations', null, device);
    await direct('/auth/device', account.token, device);
    await idle();
    if (claimHistory) await claimLegacyAccount(account.userId);
    await SecureStore.setItemAsync('qinggairugu.seen.' + account.userId, '1');
    await saveAccount(account);
    issuedToken = null;
    return account;
  } finally {
    if (issuedToken) await direct('/auth/logout', issuedToken).catch(() => {});
    changing = false;
    setAccountSwitching(false);
  }
}
export async function logoutAccount() {
  if (changing) throw new Error('账号操作正在进行');
  changing = true;
  setAccountSwitching(true);
  try {
    await idle();
    const account = await readAccount();
    if (!account) return { revoked: true };
    let revoked = true;
    try {
      await direct('/auth/logout', account.token);
    } catch {
      revoked = false;
    }
    const db = await getDatabase();
    await db.execAsync('DELETE FROM cloud_activity_cache;');
    await saveAccount(null);
    return { revoked };
  } finally {
    changing = false;
    setAccountSwitching(false);
  }
}
