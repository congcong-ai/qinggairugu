import { DatabaseSync } from 'node:sqlite';
import { beforeAll, afterAll, expect, it, vi } from 'vitest';
import { activeAIJobs } from '../activity';
const state = vi.hoisted(() => ({
  removed: [] as string[],
  failDelete: false,
  failCopy: false,
  cacheFiles: [] as string[],
  copied: [] as { source: string; target: string }[],
}));
vi.mock('expo-file-system', () => {
  class MockFile {
    uri: string;
    exists = true;
    size = 128;
    constructor(base: string | { uri: string }, ...parts: string[]) {
      this.uri = typeof base === 'string' ? base : base.uri;
      if (parts.length)
        this.uri = this.uri.replace(/\/+$/, '') + '/' + parts.join('/');
    }
    get name() {
      return this.uri.split('/').at(-1)!;
    }
    async copy(target: { uri: string }) {
      await Promise.resolve();
      if (state.failCopy) throw new Error('复制失败');
      state.copied.push({ source: this.uri, target: target.uri });
    }
    delete() {
      if (state.failDelete) throw new Error('磁盘拒绝删除');
      state.removed.push(this.uri);
      state.cacheFiles = state.cacheFiles.filter((uri) => uri !== this.uri);
    }
  }
  class MockDirectory {
    uri: string;
    constructor(base: { uri: string }, ...parts: string[]) {
      this.uri = base.uri.replace(/\/+$/, '') + '/' + parts.join('/');
    }
    create() {}
    get exists() {
      return this.uri === 'file:///cache/Audio' && state.cacheFiles.length > 0;
    }
    list() {
      return state.cacheFiles.map((uri) => new MockFile(uri));
    }
  }
  return {
    Paths: {
      cache: { uri: 'file:///cache/' },
      document: { uri: 'file:///documents/' },
    },
    File: MockFile,
    Directory: MockDirectory,
  };
});
let sqlite: DatabaseSync;
vi.mock('expo-sqlite', () => ({
  bundledExtensions: {},
  openDatabaseAsync: async () => adapter,
}));
const adapter = {
  async execAsync(sql: string) {
    sqlite.exec(sql);
  },
  async getFirstAsync(sql: string, ...args: (string | number)[]) {
    return sqlite.prepare(sql).get(...args) ?? null;
  },
  async getAllAsync(sql: string, ...args: (string | number)[]) {
    return sqlite.prepare(sql).all(...args);
  },
  async runAsync(sql: string, ...args: (string | number)[]) {
    return sqlite.prepare(sql).run(...args);
  },
  async withExclusiveTransactionAsync(fn: (db: unknown) => Promise<void>) {
    sqlite.exec('BEGIN');
    try {
      await fn(adapter);
      sqlite.exec('COMMIT');
    } catch (e) {
      sqlite.exec('ROLLBACK');
      throw e;
    }
  },
};
import {
  getDatabase,
  protectCachedRecordings,
  listSessionPeople,
  deleteSession,
  deleteRecording,
  confirmInterruptedRecording,
} from './database';
beforeAll(async () => {
  sqlite = new DatabaseSync(':memory:');
  await getDatabase();
});
afterAll(() => sqlite.close());
function seed(id: string) {
  sqlite
    .prepare(
      "INSERT INTO sessions(id,title,state,created_at,updated_at) VALUES(?,?,'interrupted','now','now')",
    )
    .run(id, id);
  sqlite
    .prepare(
      "INSERT INTO recordings(id,session_id,uri,status,created_at,checkpoint_at) VALUES(?,?,?,'interrupted','now','now')",
    )
    .run(id, id, `file:///${id}.aac`);
}
it('中断片段只有有效播放时长才可确认，并更新本场状态', async () => {
  seed('recover');
  await expect(confirmInterruptedRecording('recover', 0)).rejects.toThrow();
  await confirmInterruptedRecording('recover', 12345);
  expect(
    sqlite
      .prepare("SELECT status,duration_ms FROM recordings WHERE id='recover'")
      .get(),
  ).toMatchObject({ status: 'completed', duration_ms: 12345 });
  expect(
    sqlite.prepare("SELECT state FROM sessions WHERE id='recover'").get()
      ?.state,
  ).toBe('completed');
});
it('AI 整理期间及磁盘删除失败时保留录音索引', async () => {
  seed('keep');
  activeAIJobs.add('keep');
  await expect(deleteRecording('keep')).rejects.toThrow('AI');
  activeAIJobs.delete('keep');
  state.failDelete = true;
  await expect(deleteRecording('keep')).rejects.toThrow('磁盘');
  expect(
    sqlite.prepare("SELECT id FROM recordings WHERE id='keep'").get(),
  ).toBeTruthy();
  state.failDelete = false;
});
it('删除单段后清除失效 AI 数据，保留其它录音和 Session', async () => {
  seed('delete');
  sqlite.exec(
    "INSERT INTO recordings(id,session_id,uri,status,created_at,checkpoint_at) VALUES('other','delete','file:///other.aac','completed','now','now'); INSERT INTO summaries(id,session_id,content) VALUES('summary','delete','私人摘要'); INSERT INTO embedding_chunks(id,session_id,text,vector,model,start_ms) VALUES('chunk','delete','原文','[1,0]','test',0);",
  );
  await deleteRecording('delete');
  expect(state.removed).toContain('file:///delete.aac');
  expect(
    sqlite
      .prepare("SELECT count(*) AS n FROM recordings WHERE session_id='delete'")
      .get()?.n,
  ).toBe(1);
  expect(
    sqlite
      .prepare(
        "SELECT count(*) AS n FROM embedding_chunks WHERE session_id='delete'",
      )
      .get()?.n,
  ).toBe(0);
  expect(
    sqlite
      .prepare("SELECT count(*) AS n FROM summaries WHERE session_id='delete'")
      .get()?.n,
  ).toBe(0);
  expect(
    sqlite.prepare("SELECT state FROM sessions WHERE id='delete'").get()?.state,
  ).toBe('completed');
});

it('参与者按本机 Session 分组，同名资料不跨场合并，删除一场不影响另一场', async () => {
  seed('people-a');
  seed('people-b');
  sqlite.exec(
    "INSERT INTO participants(id,session_id,name,introduction) VALUES('a-person','people-a','小明','这场聊读书'),('b-person','people-b','小明','另一场聊硬件');",
  );
  const groups = await listSessionPeople();
  expect(groups.find((g) => g.sessionId === 'people-a')?.people).toEqual([
    { id: 'a-person', name: '小明', introduction: '这场聊读书' },
  ]);
  expect(
    groups.find((g) => g.sessionId === 'people-b')?.people[0]?.introduction,
  ).toBe('另一场聊硬件');
  await deleteSession('people-a');
  const remaining = await listSessionPeople();
  expect(remaining.some((g) => g.sessionId === 'people-a')).toBe(false);
  expect(
    remaining.find((g) => g.sessionId === 'people-b')?.people,
  ).toHaveLength(1);
});

it('缓存录音确认复制成功后再更新索引，保留真实旧格式；复制失败不丢原路径', async () => {
  seed('cached-ok');
  seed('cached-fail');
  sqlite.exec(
    "UPDATE recordings SET uri='file:///cache/Audio/oldnull' WHERE id='cached-ok';",
  );
  await protectCachedRecordings(await getDatabase());
  expect(
    sqlite.prepare("SELECT uri FROM recordings WHERE id='cached-ok'").get()
      ?.uri,
  ).toBe('file:///documents/Audio/cached-ok.3gp');
  expect(state.copied).toContainEqual({
    source: 'file:///cache/Audio/oldnull',
    target: 'file:///documents/Audio/cached-ok.3gp',
  });
  sqlite.exec(
    "UPDATE recordings SET uri='file:///cache/Audio/existing.aac' WHERE id='cached-fail';",
  );
  state.failCopy = true;
  await expect(protectCachedRecordings(await getDatabase())).rejects.toThrow(
    '复制失败',
  );
  expect(
    sqlite.prepare("SELECT uri FROM recordings WHERE id='cached-fail'").get()
      ?.uri,
  ).toBe('file:///cache/Audio/existing.aac');
  state.failCopy = false;
});

it('删除录音同时清理同 ID 的旧缓存副本，不触碰其他录音', async () => {
  seed('cache-delete');
  sqlite.exec(
    "UPDATE recordings SET uri='file:///documents/Audio/cache-delete.3gp' WHERE id='cache-delete';",
  );
  state.cacheFiles = [
    'file:///cache/Audio/cache-deletenull',
    'file:///cache/Audio/cache-delete.aac',
    'file:///cache/Audio/other.aac',
  ];
  await deleteRecording('cache-delete');
  expect(state.cacheFiles).toEqual(['file:///cache/Audio/other.aac']);
  expect(state.removed).toContain('file:///cache/Audio/cache-deletenull');
  expect(state.removed).toContain('file:///documents/Audio/cache-delete.3gp');
  state.cacheFiles = [];
});
