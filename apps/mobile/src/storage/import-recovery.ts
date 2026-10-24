import type { PhotoFile } from '../persist-photo';
export interface RecoveryDatabase {
  getAllAsync<T>(sql: string): Promise<T[]>;
  runAsync(sql: string, ...args: (string | number)[]): Promise<unknown>;
  withExclusiveTransactionAsync(
    fn: (db: Pick<RecoveryDatabase, 'runAsync'>) => Promise<void>,
  ): Promise<void>;
}
/** 启动时恢复已复制完成但未提交的导入；残缺文件保留索引供用户删除/重导。 */
export async function recoverAudioImports(
  db: RecoveryDatabase,
  file: (uri: string) => PhotoFile,
) {
  const rows = await db.getAllAsync<{
    id: string;
    session_id: string;
    uri: string;
    bytes: number | null;
    fingerprint: string | null;
  }>(
    "SELECT id,session_id,uri,bytes,fingerprint FROM recordings WHERE source='imported' AND import_state='copying'",
  );
  for (const row of rows) {
    let valid = false;
    try {
      const target = file(row.uri);
      valid = !!(
        target.exists &&
        row.bytes &&
        target.size === row.bytes &&
        row.fingerprint &&
        target.md5 === row.fingerprint
      );
    } catch {
      /* 无法读取的片段保留引用，让用户重新导入。 */
    }
    await db.withExclusiveTransactionAsync(async (tx) => {
      await tx.runAsync(
        'UPDATE recordings SET status=?,import_state=? WHERE id=?',
        valid ? 'completed' : 'missing',
        valid ? 'ready' : 'failed',
        row.id,
      );
      await tx.runAsync(
        "UPDATE sessions SET state=CASE WHEN EXISTS(SELECT 1 FROM recordings WHERE session_id=? AND status!='completed') THEN 'interrupted' ELSE 'completed' END WHERE id=?",
        row.session_id,
        row.session_id,
      );
    });
  }
}
