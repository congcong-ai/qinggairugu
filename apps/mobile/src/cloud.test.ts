import { beforeEach, afterEach, it, expect, vi } from 'vitest';
const state = vi.hoisted(() => ({ queries: [] as string[] }));
vi.mock('expo-secure-store', () => ({
  getItemAsync: async () =>
    JSON.stringify({
      id: '00000000-0000-4000-8000-000000000001',
      secret: '0'.repeat(64),
    }),
}));
vi.mock('expo-crypto', () => ({
  randomUUID: () => '00000000-0000-4000-8000-000000000002',
  getRandomBytesAsync: async () => new Uint8Array(32),
}));
vi.mock('./storage/database', () => {
  const db = {
    getFirstAsync: async () => ({
      cloud_id: '00000000-0000-4000-8000-000000000003',
    }),
    getAllAsync: async () => [],
    runAsync: async (sql: string) => {
      state.queries.push(sql);
    },
    withExclusiveTransactionAsync: async (fn: (db: unknown) => Promise<void>) =>
      fn(db),
  };
  return { getDatabase: async () => db };
});
import { syncParticipants, CloudRequestError } from './cloud';
beforeEach(() => {
  state.queries = [];
  vi.stubGlobal('__DEV__', true);
});
afterEach(() => vi.unstubAllGlobals());
it('云端请求使用显式映射，不能把本地 ID 当作云端 ID', async () => {
  const fetcher = vi.fn(
    async (url: string) =>
      new Response(
        JSON.stringify(
          url.endsWith('/participants') ? [] : { participantCount: 0 },
        ),
        { status: 200 },
      ),
  );
  vi.stubGlobal('fetch', fetcher);
  await syncParticipants('local-session');
  expect(
    fetcher.mock.calls.every(([url]) =>
      url.includes('00000000-0000-4000-8000-000000000003'),
    ),
  ).toBe(true);
  expect(
    fetcher.mock.calls.some(([url]) => url.includes('/sessions/local-session')),
  ).toBe(false);
});
it('网络或服务器暂时失败不删除本地人物及人工映射', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response(JSON.stringify({ error: '稍后重试' }), { status: 503 }),
    ),
  );
  await expect(syncParticipants('local-session')).rejects.toBeInstanceOf(
    CloudRequestError,
  );
  expect(state.queries).toEqual([]);
});
it('服务端明确撤销资料访问才清理缓存', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response(JSON.stringify({ error: '无权读取' }), { status: 403 }),
    ),
  );
  await expect(syncParticipants('local-session')).rejects.toBeInstanceOf(
    CloudRequestError,
  );
  expect(state.queries).toContain(
    'DELETE FROM participants WHERE session_id=?',
  );
});
