import { DatabaseSync } from 'node:sqlite';
import {
  mkdtempSync,
  writeFileSync,
  existsSync,
  readFileSync,
  statSync,
  rmSync,
} from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { it, expect } from 'vitest';
import { recoverAudioImports, type RecoveryDatabase } from './import-recovery';
import { migrate, type MigrationDatabase } from './migrations';
it('重启恢复完整导入；大小正确但摘要不符、缺失和半段副本均拒绝完成，不删除文件', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'qinggai-import-'));
  const db = new DatabaseSync(join(dir, 'pengtou.db'));
  const adapter: MigrationDatabase & RecoveryDatabase = {
    async execAsync(sql: string) {
      db.exec(sql);
    },
    async getFirstAsync<T>(sql: string) {
      return db.prepare(sql).get() as T;
    },
    async getAllAsync<T>(sql: string) {
      return db.prepare(sql).all() as T[];
    },
    async runAsync(sql: string, ...args: (string | number)[]) {
      return db.prepare(sql).run(...args);
    },
    async withExclusiveTransactionAsync(
      fn: (db: MigrationDatabase & RecoveryDatabase) => Promise<void>,
    ) {
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
    await migrate(adapter);
    db.exec(
      "INSERT INTO sessions(id,title,state,created_at,updated_at) VALUES('s','导入活动','interrupted','now','now')",
    );
    const hash = createHash('md5').update('good').digest('hex');
    for (const [id, bytes] of [
      ['complete', 'good'],
      ['changed', 'evil'],
      ['partial', 'g'],
      ['missing', null],
    ] as const) {
      const uri = join(dir, id + '.m4a');
      if (bytes) writeFileSync(uri, bytes);
      db.prepare(
        "INSERT INTO recordings(id,session_id,uri,status,created_at,checkpoint_at,source,bytes,fingerprint,import_state) VALUES(?,'s',?,'interrupted','now','now','imported',4,?,'copying')",
      ).run(id, uri, hash);
    }
    const file = (uri: string) => ({
      uri,
      get exists() {
        return existsSync(uri);
      },
      get size() {
        return statSync(uri).size;
      },
      get md5() {
        return createHash('md5').update(readFileSync(uri)).digest('hex');
      },
      delete() {
        throw new Error('恢复不能删除任何文件');
      },
    });
    await recoverAudioImports(adapter, file);
    await recoverAudioImports(adapter, file);
    expect(
      db
        .prepare(
          "SELECT status,import_state FROM recordings WHERE id='complete'",
        )
        .get(),
    ).toEqual({ status: 'completed', import_state: 'ready' });
    for (const id of ['changed', 'partial', 'missing'])
      expect(
        db
          .prepare('SELECT status,import_state FROM recordings WHERE id=?')
          .get(id),
      ).toEqual({ status: 'missing', import_state: 'failed' });
    expect(readFileSync(join(dir, 'partial.m4a'), 'utf8')).toBe('g');
    expect(db.prepare('SELECT state FROM sessions').get()?.state).toBe(
      'interrupted',
    );
    // 未完成片段移除后，完整导入可将 Session 恢复为完成。
    db.exec(
      "DELETE FROM recordings WHERE id!='complete'; UPDATE recordings SET status='interrupted',import_state='copying' WHERE id='complete'",
    );
    await recoverAudioImports(adapter, file);
    expect(db.prepare('SELECT state FROM sessions').get()?.state).toBe(
      'completed',
    );
  } finally {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
