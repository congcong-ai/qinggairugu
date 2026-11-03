import { beforeEach, afterEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({
  secure: new Map<string, string>(),
  recording: false,
  sql: [] as string[],
  authorize: vi.fn(),
}));
vi.mock('expo-secure-store', () => ({
  getItemAsync: async (key: string) => state.secure.get(key) ?? null,
  setItemAsync: async (key: string, value: string) => {
    state.secure.set(key, value);
  },
  deleteItemAsync: async (key: string) => {
    state.secure.delete(key);
  },
}));
vi.mock('./wechat-login', () => ({ authorizeWechat: state.authorize }));
vi.mock('./cloud', () => ({
  initializeDeviceIdentity: async () => ({
    id: '00000000-0000-4000-8000-000000000003',
    secret: 'c'.repeat(64),
  }),
  activeCloudRequests: 0,
}));
vi.mock('./storage/database', () => ({
  getDatabase: async () => ({
    getFirstAsync: async () => (state.recording ? { id: 'recording' } : null),
    execAsync: async (sql: string) => {
      state.sql.push(sql);
    },
  }),
}));
import { loginWithWechat, logoutAccount } from './account-actions';
import { readAccount, saveAccount } from './account-store';
import {
  activeAIJobs,
  activeAudioImports,
  activePhotoImports,
  activeSearches,
  assertAccountStable,
} from './activity';
const account = {
  userId: '00000000-0000-4000-8000-000000000001',
  token: 'a'.repeat(64),
  crossPlatformReady: true,
};
beforeEach(async () => {
  state.secure.clear();
  await saveAccount(null);
  state.authorize.mockReset();
  state.authorize.mockResolvedValue(account);
  state.sql = [];
  state.recording = false;
  vi.stubGlobal('__DEV__', true);
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response('{}')),
  );
});
afterEach(() => {
  activeAIJobs.clear();
  activeAudioImports.clear();
  activePhotoImports.clear();
  activeSearches.clear();
  vi.unstubAllGlobals();
});
it('录音、导入、照片、整理、语义问答未完成时拒绝切号，不能清理原数据', async () => {
  for (const jobs of [
    activeAIJobs,
    activeAudioImports,
    activePhotoImports,
    activeSearches,
  ]) {
    jobs.add('busy');
    await expect(loginWithWechat(false)).rejects.toThrow('完成');
    jobs.clear();
  }
  state.recording = true;
  await expect(loginWithWechat(false)).rejects.toThrow('录音');
  expect(state.authorize).not.toHaveBeenCalled();
  expect(state.sql).toEqual([]);
  expect(await readAccount()).toBeNull();
  expect(() => assertAccountStable()).not.toThrow();
});
it('服务端连接失败不保存新身份；连接成功后只保存账号，不默认认领原历史', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response('{}', { status: 409 })),
  );
  await expect(loginWithWechat(false)).rejects.toThrow('归属');
  expect(await readAccount()).toBeNull();
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response('{}')),
  );
  await loginWithWechat(false);
  expect((await readAccount())?.userId).toBe(account.userId);
  expect(state.secure.has('qinggairugu.legacyOwner')).toBe(false);
});
it('离线退出清除本机令牌和远端缓存，保留私人数据及待撤销队列，并如实返回未撤销状态', async () => {
  await saveAccount(account);
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      throw new Error('offline');
    }),
  );
  expect(await logoutAccount()).toEqual({ revoked: false });
  expect(await readAccount()).toBeNull();
  expect(state.secure.has('qinggairugu.account')).toBe(false);
  expect(state.sql).toEqual(['DELETE FROM cloud_activity_cache;']);
});
