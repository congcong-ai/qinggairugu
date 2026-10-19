import * as SecureStore from 'expo-secure-store';
import { randomUUID, getRandomBytesAsync } from 'expo-crypto';
import { getDatabase } from './storage/database';
import type { CloudSession, Profile } from '@pengtou/contracts';
const base = process.env.EXPO_PUBLIC_API_URL || 'http://10.0.2.2:9001';
let identityPromise: Promise<{ id: string; secret: string }> | undefined;
export async function initializeDeviceIdentity() {
  identityPromise ??= (async () => {
    const existing = await SecureStore.getItemAsync('pengtou.installation');
    if (existing) return JSON.parse(existing) as { id: string; secret: string };
    const value = {
      id: randomUUID(),
      secret: Array.from(await getRandomBytesAsync(32), (b) =>
        b.toString(16).padStart(2, '0'),
      ).join(''),
    };
    await SecureStore.setItemAsync(
      'pengtou.installation',
      JSON.stringify(value),
    );
    return value;
  })().catch((error) => {
    identityPromise = undefined;
    throw error;
  });
  return identityPromise;
}
export async function cloudRequest<T>(
  path: string,
  method = 'GET',
  data?: unknown,
): Promise<T> {
  if (!__DEV__ && !base.startsWith('https://'))
    throw new Error('正式环境需要 HTTPS 服务地址');
  const device = await initializeDeviceIdentity();
  const response = await fetch(base + path, {
    method,
    headers: {
      'content-type': 'application/json',
      'x-installation-id': device.id,
      'x-installation-secret': device.secret,
    },
    ...(data ? { body: JSON.stringify(data) } : {}),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error('暂时无法连接倾盖如故服务，请稍后重试');
  return response.json() as Promise<T>;
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
  return cloudRequest<{
    mode: string;
    miniappPath: string;
    imageDataUrl: string;
  }>(`/sessions/${id}/qr`);
}
export async function syncParticipants(id: string) {
  const [session, people] = await Promise.all([
    cloudRequest<CloudSession>(`/sessions/${id}`),
    cloudRequest<{ id: string; profile: Profile }[]>(
      `/sessions/${id}/participants`,
    ),
  ]);
  const db = await getDatabase();
  await db.withExclusiveTransactionAsync(async (txn) => {
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
