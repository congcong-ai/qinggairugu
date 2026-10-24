import { it, expect, vi, beforeEach } from 'vitest';
const state = vi.hoisted(() => ({
  bound: true,
  local: 'v2' as string | null,
  remote: {
    id: 'r' as string | null,
    version: 1,
    sourceVersion: 'v1' as string | null,
    fields: ['summary'],
    deleted: false,
  },
  requests: [] as string[],
}));
vi.mock('./cloud', () => ({
  bindingStatus: async () => ({ bindings: state.bound ? [{ id: 'b' }] : [] }),
  cloudSessionId: async () => null,
  cloudRequest: async (path: string) => {
    state.requests.push(path);
    return state.remote;
  },
}));
vi.mock('./storage/database', () => ({
  getDatabase: async () => ({
    getFirstAsync: async () => ({ source_version: state.local }),
  }),
}));
import { syncState } from './private-sync';
beforeEach(() => {
  state.bound = true;
  state.local = 'v2';
  state.remote = {
    id: 'r',
    version: 1,
    sourceVersion: 'v1',
    fields: ['summary'],
    deleted: false,
  };
  state.requests = [];
});
it('本机重新整理后只提示待同步，不自动上传内容', async () => {
  const result = await syncState('s');
  expect(result.hasNewVersion).toBe(true);
  expect(state.requests).toEqual(['/me/private-ai/state/s']);
  expect(result.remote.fields).toEqual(['summary']);
});
it('已同步相同版本没有待更新提示', async () => {
  state.local = 'v1';
  expect((await syncState('s')).hasNewVersion).toBe(false);
});
it.each(['未同步', '已撤销'] as const)(
  '%s 不显示成有可读的新云端结果',
  async (mode) => {
    if (mode === '未同步') state.remote.id = null;
    else state.remote.deleted = true;
    expect((await syncState('s')).hasNewVersion).toBe(false);
  },
);
it('旧记录无来源版本时与 legacy 快照保持兼容', async () => {
  state.local = null;
  state.remote.sourceVersion = 'legacy';
  expect((await syncState('s')).hasNewVersion).toBe(false);
});
it('未绑定时拒绝请求私人快照', async () => {
  state.bound = false;
  await expect(syncState('s')).rejects.toThrow('关联小程序');
  expect(state.requests).toEqual([]);
});
