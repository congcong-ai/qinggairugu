import { activeAIJobs } from '../activity';
import {
  openDatabaseAsync,
  bundledExtensions,
  type SQLiteDatabase,
} from 'expo-sqlite';
import { File, Directory, Paths } from 'expo-file-system';
import { migrate } from './migrations';
export interface LocalSession {
  id: string;
  title: string;
  state: string;
  created_at: string;
  duration_ms: number;
}
export interface LocalRecording {
  id: string;
  session_id: string;
  uri: string;
  duration_ms: number;
  status: string;
}
let database: Promise<SQLiteDatabase> | undefined;
export let nativeVectorAvailable = false;
export function getDatabase() {
  database ??= (async () => {
    const db = await openDatabaseAsync('pengtou.db');
    await migrate(db);
    await protectCachedRecordings(db);
    const extension = bundledExtensions['sqlite-vec'];
    if (extension) {
      try {
        await db.loadExtensionAsync(extension.libPath, extension.entryPoint);
        await db.getFirstAsync('SELECT vec_version()');
        nativeVectorAvailable = true;
      } catch {
        nativeVectorAvailable = false;
      }
    }
    // 初始化时只做一次，不能在每次读列表时把当前录音标记为中断。
    await db.execAsync(
      "UPDATE recordings SET status = 'interrupted' WHERE status IN ('recording','paused'); UPDATE sessions SET state = 'interrupted' WHERE state IN ('recording','paused');",
    );
    return db;
  })().catch((error) => {
    database = undefined;
    throw error;
  });
  return database;
}
export async function listSessions() {
  const db = await getDatabase();
  return db.getAllAsync<LocalSession>(
    'SELECT s.*, COALESCE(SUM(r.duration_ms),0) AS duration_ms FROM sessions s LEFT JOIN recordings r ON r.session_id = s.id GROUP BY s.id ORDER BY s.created_at DESC',
  );
}
export async function recordingsForSession(id: string) {
  return (await getDatabase()).getAllAsync<LocalRecording>(
    'SELECT * FROM recordings WHERE session_id = ? ORDER BY created_at',
    id,
  );
}
export async function renameSession(id: string, title: string) {
  if (!title.trim() || title.trim().length > 120)
    throw new Error('名称需要为 1 到 120 个字');
  await (
    await getDatabase()
  ).runAsync(
    'UPDATE sessions SET title = ?, updated_at = ? WHERE id = ?',
    title.trim(),
    new Date().toISOString(),
    id,
  );
}
function removeCachedCopies(id: string) {
  const cache = new Directory(Paths.cache, 'Audio');
  if (!cache.exists) return;
  for (const entry of cache.list())
    if (
      entry instanceof File &&
      (entry.name === `${id}null` || entry.name.startsWith(`${id}.`))
    )
      entry.delete();
}
export async function deleteSession(id: string) {
  if (activeAIJobs.has(id)) throw new Error('请等待 AI 整理完成');
  const db = await getDatabase();
  const active = await db.getFirstAsync(
    "SELECT id FROM recordings WHERE session_id = ? AND status IN ('recording','paused')",
    id,
  );
  if (active) throw new Error('请先完成当前录音');
  // 先删文件再删数据库：文件删除失败时保留索引供重试。
  for (const recording of await recordingsForSession(id)) {
    removeCachedCopies(recording.id);
    const file = new File(recording.uri);
    if (file.exists) file.delete();
  }
  await db.runAsync('DELETE FROM sessions WHERE id = ?', id);
}

export async function confirmInterruptedRecording(
  id: string,
  durationMs: number,
) {
  const db = await getDatabase();
  const row = await db.getFirstAsync<LocalRecording>(
    'SELECT * FROM recordings WHERE id=?',
    id,
  );
  if (!row || row.status !== 'interrupted' || activeAIJobs.has(row.session_id))
    throw new Error('当前录音无法恢复');
  if (
    !Number.isFinite(durationMs) ||
    durationMs <= 0 ||
    !new File(row.uri).exists
  )
    throw new Error('请先完整试听录音');
  await db.withExclusiveTransactionAsync(async (txn) => {
    await txn.runAsync(
      "UPDATE recordings SET status='completed',duration_ms=?,checkpoint_at=? WHERE id=? AND status='interrupted'",
      Math.round(durationMs),
      new Date().toISOString(),
      id,
    );
    await txn.runAsync(
      "UPDATE sessions SET state='completed' WHERE id=? AND NOT EXISTS(SELECT 1 FROM recordings WHERE session_id=? AND status!='completed')",
      row.session_id,
      row.session_id,
    );
  });
}

export async function deleteRecording(id: string) {
  const db = await getDatabase();
  const row = await db.getFirstAsync<LocalRecording>(
    'SELECT * FROM recordings WHERE id=?',
    id,
  );
  if (!row) return;
  if (activeAIJobs.has(row.session_id)) throw new Error('请等待 AI 整理完成');
  if (
    await db.getFirstAsync(
      "SELECT id FROM recordings WHERE session_id=? AND status IN ('recording','paused')",
      row.session_id,
    )
  )
    throw new Error('请先完成当前录音');
  removeCachedCopies(row.id);
  const file = new File(row.uri);
  if (file.exists) file.delete();
  await db.withExclusiveTransactionAsync(async (txn) => {
    // 本场摘要、草稿及搜索索引依赖全部录音，删除片段后必须重新整理。
    for (const table of [
      'embedding_chunks',
      'transcript_segments',
      'speakers',
      'summaries',
      'topics',
      'actions',
      'ai_jobs',
    ])
      await txn.runAsync(
        `DELETE FROM ${table} WHERE session_id=?`,
        row.session_id,
      );
    await txn.runAsync('DELETE FROM recordings WHERE id=?', id);
    await txn.runAsync(
      "UPDATE sessions SET state=CASE WHEN EXISTS(SELECT 1 FROM recordings WHERE session_id=? AND status!='completed') THEN 'interrupted' WHEN EXISTS(SELECT 1 FROM recordings WHERE session_id=?) THEN 'completed' ELSE 'ready' END,updated_at=? WHERE id=?",
      row.session_id,
      row.session_id,
      new Date().toISOString(),
      row.session_id,
    );
  });
}

export interface SessionPeople {
  sessionId: string;
  sessionTitle: string;
  createdAt: string;
  people: { id: string; name: string; introduction: string }[];
}
export async function listSessionPeople(): Promise<SessionPeople[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{
    sessionId: string;
    sessionTitle: string;
    createdAt: string;
    id: string;
    name: string;
    introduction: string;
  }>(
    'SELECT s.id AS sessionId,s.title AS sessionTitle,s.created_at AS createdAt,p.id,p.name,p.introduction FROM sessions s JOIN participants p ON p.session_id=s.id ORDER BY s.created_at DESC,s.id,p.rowid',
  );
  const groups = new Map<string, SessionPeople>();
  for (const row of rows) {
    let group = groups.get(row.sessionId);
    if (!group) {
      group = {
        sessionId: row.sessionId,
        sessionTitle: row.sessionTitle,
        createdAt: row.createdAt,
        people: [],
      };
      groups.set(row.sessionId, group);
    }
    group.people.push({
      id: row.id,
      name: row.name,
      introduction: row.introduction,
    });
  }
  return [...groups.values()];
}

// 兼容早期开发包误写入缓存的录音。先复制并核对大小，再更新索引；失败保留原文件与索引。
export async function protectCachedRecordings(db: SQLiteDatabase) {
  const rows = await db.getAllAsync<LocalRecording>('SELECT * FROM recordings');
  for (const row of rows) {
    if (
      !row.uri.startsWith(
        new Directory(Paths.cache, 'Audio').uri.replace(/\/+$/, '') + '/',
      )
    )
      continue;
    const source = new File(row.uri);
    if (!source.exists || source.size === 0) continue;
    const directory = new Directory(Paths.document, 'Audio');
    directory.create({ idempotent: true, intermediates: true });
    // 旧包只传 fileName 导致默认 3GP/AMR，真机已验证；不能仅改名假装成 AAC。
    const extension = source.name.endsWith('null')
      ? '.3gp'
      : (source.name.match(/\.[a-zA-Z0-9]+$/)?.[0] ?? '.recording');
    const target = new File(directory, `${row.id}${extension}`);
    if (target.exists) target.delete();
    await source.copy(target);
    if (!target.exists || target.size !== source.size)
      throw new Error('录音持久化校验失败，原文件已保留');
    await db.runAsync(
      'UPDATE recordings SET uri=? WHERE id=?',
      target.uri,
      row.id,
    );
    try {
      source.delete();
    } catch {
      /* 删除录音时会再次清理相同录音 ID 的缓存副本。 */
    }
  }
}
