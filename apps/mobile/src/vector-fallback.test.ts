import { DatabaseSync } from 'node:sqlite';
import { beforeAll, afterAll, it, expect, vi } from 'vitest';
import { migrate, type MigrationDatabase } from './storage/migrations';
import { bailianConfig } from '@pengtou/ai';
vi.mock('expo-file-system', () => ({ File: class {} }));
vi.mock('expo/fetch', () => ({ fetch: vi.fn() }));
vi.mock('./ai-key', () => ({ readAIKey: async () => null }));
let sqlite: DatabaseSync;
const db: MigrationDatabase & {
  getAllAsync<T>(sql: string, ...args: (string | number)[]): Promise<T[]>;
  runAsync(sql: string, ...args: (string | number)[]): Promise<unknown>;
} = {
  async execAsync(sql) {
    sqlite.exec(sql);
  },
  async getFirstAsync<T>(sql: string) {
    return sqlite.prepare(sql).get() as T;
  },
  async getAllAsync<T>(sql: string, ...args: (string | number)[]) {
    return sqlite.prepare(sql).all(...args) as T[];
  },
  async runAsync(sql, ...args) {
    return sqlite.prepare(sql).run(...args);
  },
  async withExclusiveTransactionAsync(fn) {
    sqlite.exec('BEGIN');
    try {
      await fn(db);
      sqlite.exec('COMMIT');
    } catch (e) {
      sqlite.exec('ROLLBACK');
      throw e;
    }
  },
};
vi.mock('./storage/database', () => ({
  getDatabase: async () => db,
  recordingsForSession: async () => [],
  nativeVectorAvailable: false,
}));
import { SQLiteVectorStore } from './ai-processing';
beforeAll(async () => {
  sqlite = new DatabaseSync(':memory:');
  await migrate(db);
  sqlite.exec(
    "INSERT INTO sessions(id,title,state,created_at,updated_at) VALUES('a','历史活动','completed','old','old'),('b','另一场','completed','old','old'); INSERT INTO speakers(id,session_id,label) VALUES('sp','a','发言人1')",
  );
  for (const [id, session, vector, model, speaker] of [
    ['near', 'a', '[1,0]', bailianConfig.embeddingModel, 'sp'],
    ['middle', 'a', '[0.7,0.3]', bailianConfig.embeddingModel, null],
    ['far', 'b', '[-1,0]', bailianConfig.embeddingModel, null],
    ['old-model', 'a', '[1,0]', 'other-model', null],
  ] as const)
    sqlite
      .prepare(
        'INSERT INTO embedding_chunks(id,session_id,text,vector,model,start_ms,speaker_id) VALUES(?,?,?,?,?,0,?)',
      )
      .run(id, session, '历史原文', vector, model, speaker);
});
afterAll(() => sqlite.close());
it('关闭原生 vec 后直接搜索历史 JSON 向量，顺序、来源和模型隔离正确', async () => {
  const before = sqlite
    .prepare('SELECT * FROM embedding_chunks ORDER BY id')
    .all();
  const result = await new SQLiteVectorStore().search([1, 0], 2);
  expect(result.map((x) => x.id)).toEqual(['near', 'middle']);
  expect(result[0]?.sessionId).toBe('a');
  expect(result[0]?.score).toBe(1);
  expect(
    sqlite.prepare('SELECT * FROM embedding_chunks ORDER BY id').all(),
  ).toEqual(before);
});
it('JS 检索仍限定人工匹配的 Speaker', async () => {
  expect(
    (await new SQLiteVectorStore().search([1, 0], 8, ['sp'])).map((x) => x.id),
  ).toEqual(['near']);
});
it('追加、更新、删除沿用既有表和 ID，不需要重建索引或清空其它场次', async () => {
  const store = new SQLiteVectorStore();
  await store.upsert([
    { id: 'new', sessionId: 'b', text: '新增原文', vector: [0, 1] },
  ]);
  await store.upsert([
    { id: 'new', sessionId: 'b', text: '修订原文', vector: [0.1, 0.9] },
  ]);
  expect(
    sqlite.prepare("SELECT text FROM embedding_chunks WHERE id='new'").get()
      ?.text,
  ).toBe('修订原文');
  await store.delete('b');
  expect(
    sqlite
      .prepare(
        "SELECT count(*) AS n FROM embedding_chunks WHERE session_id='a'",
      )
      .get()?.n,
  ).toBe(3);
});
