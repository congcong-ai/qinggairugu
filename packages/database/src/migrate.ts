import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import type { Sql } from 'postgres';
export async function migrateCloud(sql: Sql) {
  const source = await readFile(
    new URL('../migrations/0001_shared_sessions.sql', import.meta.url),
    'utf8',
  );
  const checksum = createHash('sha256').update(source).digest('hex');
  await sql.begin(async (txn) => {
    await txn`SELECT pg_advisory_xact_lock(706568674)`;
    await txn`CREATE TABLE IF NOT EXISTS pengtou_migrations (version INTEGER PRIMARY KEY, checksum TEXT NOT NULL, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())`;
    const [applied] =
      await txn`SELECT checksum FROM pengtou_migrations WHERE version = 1`;
    if (applied && applied.checksum !== checksum)
      throw new Error('已执行迁移不能修改，请创建新迁移');
    if (!applied) {
      await txn.unsafe(source);
      await txn`INSERT INTO pengtou_migrations(version,checksum) VALUES(1,${checksum})`;
    }
  });
}
