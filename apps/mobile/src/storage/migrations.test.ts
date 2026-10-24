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
    ).toBe(17);
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

it('SQLite v1/v2 存量升级保留录音、Speaker、转写与向量且不改变文件引用', async () => {
  const { migrations } = await import('./migrations');
  for (const version of [1, 2]) {
    const db = new DatabaseSync(':memory:');
    const adapter: MigrationDatabase = {
      async execAsync(sql) {
        db.exec(sql);
      },
      async getFirstAsync<T>(sql: string) {
        return db.prepare(sql).get() as T;
      },
      async withExclusiveTransactionAsync(fn) {
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
    try {
      for (const m of migrations.filter((m) => m.version <= version))
        db.exec(m.sql);
      db.exec(`PRAGMA user_version=${version}`);
      db.exec(
        "INSERT INTO sessions(id,title,state,created_at,updated_at) VALUES('s','历史记录','completed','old','old'); INSERT INTO recordings(id,session_id,uri,status,created_at,checkpoint_at) VALUES('r','s','file:///documents/Audio/old.aac','completed','old','old'); INSERT INTO speakers(id,session_id,label) VALUES('sp','s','发言人1'); INSERT INTO transcript_segments(id,session_id,recording_id,speaker_id,start_ms,end_ms,text) VALUES('t','s','r','sp',0,10,'历史原文'); INSERT INTO embedding_chunks(id,session_id,text,vector,model,start_ms,speaker_id) VALUES('e','s','历史原文','[1,0]','old-model',0,'sp');",
      );
      await migrate(adapter);
      await migrate(adapter);
      expect(
        db.prepare('SELECT uri,source FROM recordings WHERE id=?').get('r'),
      ).toEqual({ uri: 'file:///documents/Audio/old.aac', source: 'recorded' });
      expect(
        db.prepare('SELECT text FROM transcript_segments').get()?.text,
      ).toBe('历史原文');
      expect(
        db.prepare('SELECT vector FROM embedding_chunks').get()?.vector,
      ).toBe('[1,0]');
      expect(db.prepare('PRAGMA user_version').get()?.user_version).toBe(5);
      db.exec(
        "INSERT INTO personal_entries(id,occurred_at) VALUES('s','now'); INSERT INTO personal_photos(id,session_id,uri) VALUES('p','s','file:///local.jpg'); DELETE FROM sessions WHERE id='s';",
      );
      expect(
        db.prepare('SELECT count(*) AS n FROM personal_photos').get()?.n,
      ).toBe(0);
    } finally {
      db.close();
    }
  }
});
