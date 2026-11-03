import * as SecureStore from 'expo-secure-store';
export interface Account {
  userId: string;
  token: string;
  crossPlatformReady: boolean;
}
const key = 'qinggairugu.account';
let loaded: Promise<Account | null> | undefined;
let generation = 0;
const listeners = new Set<() => void>();
export const accountGeneration = () => generation;
export const subscribeAccount = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};
export function readAccount() {
  loaded ??= SecureStore.getItemAsync(key).then((value) => {
    if (!value) return null;
    const account = JSON.parse(value) as Account;
    if (
      !/^[a-f0-9-]{36}$/.test(account.userId) ||
      !/^[a-f0-9]{64}$/.test(account.token)
    )
      throw new Error('账号信息损坏，请重新登录');
    return account;
  });
  return loaded;
}
export async function storageScope(input?: Account | null) {
  const account = input === undefined ? await readAccount() : input;
  const owner = await SecureStore.getItemAsync('qinggairugu.legacyOwner');
  if (account?.userId === owner || (!account && !owner)) return 'legacy';
  return account ? 'account-' + account.userId : 'guest';
}
export async function saveAccount(account: Account | null) {
  if (account) await SecureStore.setItemAsync(key, JSON.stringify(account));
  else await SecureStore.deleteItemAsync(key);
  loaded = Promise.resolve(account);
  generation++;
  listeners.forEach((fn) => fn());
}
export async function claimLegacyAccount(userId: string) {
  const owner = await SecureStore.getItemAsync('qinggairugu.legacyOwner');
  if (owner && owner !== userId) throw new Error('这批历史记录已归属另一账号');
  await SecureStore.setItemAsync('qinggairugu.legacyOwner', userId);
}
