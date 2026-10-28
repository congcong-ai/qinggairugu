import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import type { Sql } from 'postgres';
export async function migrateCloud(sql: Sql) {
  const files = [
    '0001_shared_sessions.sql',
    '0002_identity_bindings.sql',
    '0003_personal_entries.sql',
    '0004_private_ai.sql',
    '0005_recap_lifecycle.sql',
    '0006_activity_starters.sql',
    '0007_wechat_accounts.sql',
  ];
  await sql.begin(async (txn) => {
    await txn`SELECT pg_advisory_xact_lock(706568674)`;
    await txn`CREATE TABLE IF NOT EXISTS pengtou_migrations (version INTEGER PRIMARY KEY, checksum TEXT NOT NULL, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())`;
    const existing =
      await txn`SELECT version,checksum FROM pengtou_migrations ORDER BY version`;
    if (existing.some((row) => row.version > files.length))
      throw new Error('数据库版本较新，请升级服务');
    for (const [index, file] of files.entries()) {
      const version = index + 1;
      const source = await readFile(
        new URL('../migrations/' + file, import.meta.url),
        'utf8',
      );
      const checksum = createHash('sha256').update(source).digest('hex');
      const applied = existing.find((row) => row.version === version);
      if (applied && applied.checksum !== checksum)
        throw new Error('已执行迁移不能修改，请创建新迁移');
      if (!applied) {
        await txn.unsafe(source);
        await txn`INSERT INTO pengtou_migrations(version,checksum) VALUES(${version},${checksum})`;
      }
    }
  });
}
