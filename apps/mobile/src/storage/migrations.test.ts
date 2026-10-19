import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { migrate, type MigrationDatabase } from './migrations';
it('真实 SQLite 迁移、重启持久化、外键级联与幂等', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'pengtou-db-'));
  const path = join(dir, 'pengtou.db');
  let db = new DatabaseSync(path);
  const adapter: MigrationDatabase = {
    async execAsync(sql) {
      db.exec(sql);
    },
    async getFirstAsync<T>(sql: string) {
      return (db.prepare(sql).get() as T) ?? null;
    },
    async withExclusiveTransactionAsync(fn) {
      db.exec('BEGIN EXCLUSIVE');
      try {
        await fn(adapter);
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
  };
  try {
    await migrate(adapter);
    await migrate(adapter);
    expect(
      db
        .prepare("SELECT count(*) AS n FROM sqlite_master WHERE type='table'")
        .get()?.n,
    ).toBe(12);
    db.exec(
      "INSERT INTO sessions(id,title,state,created_at,updated_at) VALUES('s','一次见面','recording','now','now'); INSERT INTO recordings(id,session_id,uri,status,created_at,checkpoint_at) VALUES('r','s','file:///recording.m4a','recording','now','now');",
    );
    db.close();
    db = new DatabaseSync(path);
    await migrate(adapter);
    expect(db.prepare('SELECT title FROM sessions').get()?.title).toBe(
      '一次见面',
    );
    expect(() => db.exec("UPDATE recordings SET status='unknown'")).toThrow();
    db.exec("DELETE FROM sessions WHERE id='s'");
    expect(db.prepare('SELECT count(*) AS n FROM recordings').get()?.n).toBe(0);
  } finally {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
