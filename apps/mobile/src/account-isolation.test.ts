import { DatabaseSync } from 'node:sqlite';
import { afterAll, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ secure: new Map<string, string>() }));
vi.mock('expo-secure-store', () => ({
  getItemAsync: async (key: string) => state.secure.get(key) ?? null,
  setItemAsync: async (key: string, value: string) => {
    state.secure.set(key, value);
  },
  deleteItemAsync: async (key: string) => {
    state.secure.delete(key);
  },
}));
const handles = new Map<string, DatabaseSync>();
vi.mock('expo-sqlite', () => ({
  bundledExtensions: {},
  openDatabaseAsync: async (name: string) => {
    const db = new DatabaseSync(':memory:');
    handles.set(name, db);
    const adapter = {
      execAsync: async (sql: string) => {
        db.exec(sql);
      },
      getFirstAsync: async (sql: string, ...params: string[]) =>
        db.prepare(sql).get(...params) ?? null,
      getAllAsync: async (sql: string, ...params: string[]) =>
        db.prepare(sql).all(...params),
      runAsync: async (sql: string, ...params: string[]) =>
        db.prepare(sql).run(...params),
      withExclusiveTransactionAsync: async (
        fn: (tx: unknown) => Promise<void>,
      ) => {
        db.exec('BEGIN');
        try {
          await fn(adapter);
          db.exec('COMMIT');
        } catch (e) {
          db.exec('ROLLBACK');
          throw e;
        }
      },
    };
    return adapter;
  },
}));
vi.mock('expo-file-system', () => ({
  Paths: {
    cache: { uri: 'file:///cache' },
    document: { uri: 'file:///documents' },
  },
  File: class {},
  Directory: class {
    uri = 'file:///cache/Audio';
  },
}));
import { getDatabase } from './storage/database';
import {
  saveAccount,
  readAccount,
  storageScope,
  claimLegacyAccount,
} from './account-store';
const a = {
  userId: '00000000-0000-4000-8000-000000000001',
  token: 'a'.repeat(64),
  crossPlatformReady: true,
};
const b = {
  ...a,
  userId: '00000000-0000-4000-8000-000000000002',
  token: 'b'.repeat(64),
};
afterAll(() => handles.forEach((db) => db.close()));
it('真实SQLite：免登录、两个账号、详情及搜索数据分别隔离，退出不删除本机记录', async () => {
  const guest = await getDatabase();
  await guest.runAsync(
    "INSERT INTO sessions(id,title,state,created_at,updated_at) VALUES('old','匿名历史','completed','now','now')",
  );
  await saveAccount(a);
  const first = await getDatabase();
  expect(
    await first.getFirstAsync("SELECT id FROM sessions WHERE id='old'"),
  ).toBeNull();
  await first.runAsync(
    "INSERT INTO sessions(id,title,state,created_at,updated_at) VALUES('a','账号甲','completed','now','now')",
  );
  await first.runAsync(
    "INSERT INTO embedding_chunks(id,session_id,text,vector,model,start_ms) VALUES('e','a','账号甲原文','[1,0]','test',0)",
  );
  await saveAccount(b);
  const second = await getDatabase();
  expect(
    await second.getFirstAsync("SELECT * FROM sessions WHERE id='a'"),
  ).toBeNull();
  expect(await second.getAllAsync('SELECT * FROM embedding_chunks')).toEqual(
    [],
  );
  await saveAccount(null);
  expect(
    (
      await (
        await getDatabase()
      ).getFirstAsync<{ title: string }>(
        "SELECT title FROM sessions WHERE id='old'",
      )
    )?.title,
  ).toBe('匿名历史');
  expect(await readAccount()).toBeNull();
  await saveAccount(a);
  expect(
    (
      await (
        await getDatabase()
      ).getFirstAsync<{ title: string }>(
        "SELECT title FROM sessions WHERE id='a'",
      )
    )?.title,
  ).toBe('账号甲');
});
it('匿名历史认领只改本机归属，不允许另一个账号重复认领；退出进入新访客空间', async () => {
  await saveAccount(null);
  await claimLegacyAccount(b.userId);
  await saveAccount(b);
  expect(await storageScope()).toBe('legacy');
  expect(
    (
      await (
        await getDatabase()
      ).getFirstAsync<{ title: string }>(
        "SELECT title FROM sessions WHERE id='old'",
      )
    )?.title,
  ).toBe('匿名历史');
  await expect(claimLegacyAccount(a.userId)).rejects.toThrow('另一账号');
  await saveAccount(null);
  expect(await storageScope()).toBe('guest');
  expect(
    await (await getDatabase()).getAllAsync('SELECT * FROM sessions'),
  ).toEqual([]);
});
