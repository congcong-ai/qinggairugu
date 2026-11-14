import { assertAccountStable } from './activity';
import { readAccount, storageScope, accountGeneration } from './account-store';
import * as SecureStore from 'expo-secure-store';
import { randomUUID, getRandomBytesAsync } from 'expo-crypto';
import { getDatabase } from './storage/database';
import type { CloudSession, Profile } from '@qinggairugu/contracts';
const base =
  process.env.EXPO_PUBLIC_API_URL ||
  (typeof __DEV__ !== 'undefined' && __DEV__
    ? 'http://10.0.2.2:9001'
    : 'https://qgrg.bebackpacker.com');
const identityPromises = new Map<
  string,
  Promise<{ id: string; secret: string }>
>();
export let activeCloudRequests = 0;
export async function initializeDeviceIdentity(input?: string) {
  const scope = input ?? (await storageScope());
  const key =
    scope === 'legacy'
      ? 'qinggairugu.installation'
      : `qinggairugu.installation.${scope}`;
  let identityPromise = identityPromises.get(scope);
  identityPromise ??= (async () => {
    const existing = await SecureStore.getItemAsync(key);
    if (existing) return JSON.parse(existing) as { id: string; secret: string };
    const value = {
      id: randomUUID(),
      secret: Array.from(await getRandomBytesAsync(32), (b) =>
        b.toString(16).padStart(2, '0'),
      ).join(''),
    };
    await SecureStore.setItemAsync(key, JSON.stringify(value));
    return value;
  })().catch((error) => {
    identityPromises.delete(scope);
    throw error;
  });
  identityPromises.set(scope, identityPromise);
  return identityPromise;
}
export class CloudRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}
export async function cloudRequest<T>(
  path: string,
  method = 'GET',
  data?: unknown,
): Promise<T> {
  assertAccountStable();
  if (!__DEV__ && !base.startsWith('https://'))
    throw new Error('正式环境需要 HTTPS 服务地址');
  const epoch = accountGeneration();
  activeCloudRequests++;
  try {
    const account = await readAccount();
    const device = await initializeDeviceIdentity();
    assertAccountStable();
    const response = await fetch(base + path, {
      method,
      headers: {
        'content-type': 'application/json',
        ...(account ? { authorization: `Bearer ${account.token}` } : {}),
        'x-installation-id': device.id,
        'x-installation-secret': device.secret,
      },
      ...(data ? { body: JSON.stringify(data) } : {}),
      signal: AbortSignal.timeout(15000),
    });
    if (epoch !== accountGeneration())
      throw new Error('账号已切换，请重新打开');
    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      throw new CloudRequestError(
        result.error || '暂时无法连接倾盖如故服务，请稍后重试',
        response.status,
      );
    }
    const result = (await response.json()) as T;
    if (epoch !== accountGeneration())
      throw new Error('账号已切换，请重新打开');
    return result;
  } finally {
    activeCloudRequests--;
  }
}
export async function ensureCloudSession(id: string) {
  const db = await getDatabase();
  const local = await db.getFirstAsync<{
    id: string;
    title: string;
    cloud_id: string | null;
    participant_visibility: 'everyone' | 'organizer_only';
    starts_at: string | null;
  }>('SELECT * FROM sessions WHERE id = ?', id);
  if (!local) throw new Error('记录不存在');
  if (!local.cloud_id) {
    await cloudRequest(
      '/installations',
      'POST',
      await initializeDeviceIdentity(),
    );
    await cloudRequest('/sessions', 'POST', {
      id: local.id,
      title: local.title,
      participantVisibility: local.participant_visibility,
      startsAt: local.starts_at,
    });
    await db.runAsync('UPDATE sessions SET cloud_id = ? WHERE id = ?', id, id);
  }
}
export async function shareSession(id: string) {
  await ensureCloudSession(id);
  const cloudId = await cloudSessionId(id);
  // 新版 App 生成加入码时，本场参与者可以互相查看「关于我」。
  // 服务端已有发起人权限校验；同一个二维码也会立即应用到旧场次。
  await cloudRequest(`/sessions/${cloudId}`, 'PATCH', {
    participantVisibility: 'everyone',
  });
  await (
    await getDatabase()
  ).runAsync(
    "UPDATE sessions SET participant_visibility='everyone' WHERE id=?",
    id,
  );
  return cloudRequest<{
    mode: string;
    miniappPath: string;
    imageDataUrl: string;
  }>(`/sessions/${cloudId}/qr`);
}
export async function syncParticipants(id: string) {
  const cloudId = await cloudSessionId(id);
  const [session, people] = await Promise.all([
    cloudRequest<CloudSession>(`/sessions/${cloudId}`),
    cloudRequest<{ id: string; profile: Profile }[]>(
      `/sessions/${cloudId}/participants`,
    ),
  ]).catch(async (error) => {
    // 网络暂时失败不能删除本地人物映射；只有服务端明确撤销资料访问才清理缓存。
    if (error instanceof CloudRequestError && error.status === 403)
      await (
        await getDatabase()
      ).runAsync('DELETE FROM participants WHERE session_id=?', id);
    throw error;
  });
  const db = await getDatabase();
  await db.withExclusiveTransactionAsync(async (txn) => {
    const allowed = people.map((p) => `${id}:${p.id}`);
    const old = await txn.getAllAsync<{ id: string }>(
      'SELECT id FROM participants WHERE session_id=?',
      id,
    );
    for (const person of old)
      if (!allowed.includes(person.id))
        await txn.runAsync('DELETE FROM participants WHERE id=?', person.id);
    for (const person of people)
      await txn.runAsync(
        'INSERT INTO participants(id,session_id,name,introduction) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,introduction=excluded.introduction',
        `${id}:${person.id}`,
        id,
        person.profile.name,
        person.profile.introduction,
      );
  });
  return { session, people };
}

export async function registerDevice() {
  await cloudRequest(
    '/installations',
    'POST',
    await initializeDeviceIdentity(),
  );
}
export async function cloudSessionId(id: string) {
  const row = await (
    await getDatabase()
  ).getFirstAsync<{ cloud_id: string | null }>(
    'SELECT cloud_id FROM sessions WHERE id=?',
    id,
  );
  if (!row?.cloud_id) throw new Error('请先关联或分享这场活动');
  return row.cloud_id;
}
export async function bindingStatus() {
  await registerDevice();
  const state = await cloudRequest<{
    userId: string | null;
    bindings: { id: string; installationId: string }[];
  }>('/bindings');
  const db = await getDatabase();
  const pending = await db.getAllAsync<{
    id: string;
    target_id: string;
    binding_id: string;
  }>(
    "SELECT * FROM pending_operations WHERE kind='private-ai-delete' ORDER BY created_at",
  );
  for (const operation of pending) {
    if (state.bindings.some((b) => b.id === operation.binding_id))
      await cloudRequest(`/me/private-ai/${operation.target_id}`, 'DELETE');
    await db.runAsync(
      'DELETE FROM pending_operations WHERE id=?',
      operation.id,
    );
  }
  return state;
}
export async function clearBoundCache() {
  const db = await getDatabase();
  await db.execAsync(
    'DELETE FROM cloud_activity_cache; DELETE FROM ai_sync_state; DELETE FROM pending_operations;',
  );
}
export async function refreshActivities() {
  const state = await bindingStatus();
  const db = await getDatabase();
  await db.runAsync(
    'DELETE FROM cloud_activity_cache WHERE user_id != ?',
    state.userId ?? '',
  );
  if (!state.userId) return [];
  const all: import('@qinggairugu/contracts').ActivityItem[] = [];
  let offset: number | null = 0;
  while (offset !== null) {
    const data: {
      items: import('@qinggairugu/contracts').ActivityItem[];
      nextOffset: number | null;
    } = await cloudRequest<{
      items: import('@qinggairugu/contracts').ActivityItem[];
      nextOffset: number | null;
    }>(`/me/activities?offset=${offset}`);
    all.push(...data.items);
    offset = data.nextOffset;
  }
  await db.withExclusiveTransactionAsync(async (tx) => {
    await tx.runAsync('DELETE FROM cloud_activity_cache');
    for (const row of all)
      await tx.runAsync(
        'INSERT INTO cloud_activity_cache(id,user_id,data) VALUES(?,?,?)',
        row.id,
        state.userId!,
        JSON.stringify(row),
      );
  });
  return all;
}
export async function openCloudActivity(sessionId: string) {
  const db = await getDatabase();
  const current = await db.getFirstAsync<{ id: string }>(
    'SELECT id FROM sessions WHERE cloud_id=?',
    sessionId,
  );
  if (current) return current.id;
  const remote = await cloudRequest<CloudSession>(`/sessions/${sessionId}`);
  const id = randomUUID();
  const now = new Date().toISOString();
  await db.runAsync(
    'INSERT INTO sessions(id,title,state,created_at,updated_at,cloud_id,participant_visibility,starts_at) VALUES(?,?,?,?,?,?,?,?)',
    id,
    remote.title,
    'ready',
    now,
    now,
    remote.id,
    remote.participantVisibility,
    remote.startsAt,
  );
  return id;
}
