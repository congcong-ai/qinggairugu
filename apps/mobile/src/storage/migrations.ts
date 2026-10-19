export interface MigrationDatabase {
  execAsync(sql: string): Promise<void>;
  getFirstAsync<T>(sql: string): Promise<T | null>;
  withExclusiveTransactionAsync(
    task: (txn: MigrationDatabase) => Promise<void>,
  ): Promise<void>;
}
export const migrations = [
  {
    version: 1,
    sql: `
CREATE TABLE sessions (
 id TEXT PRIMARY KEY, title TEXT NOT NULL, state TEXT NOT NULL CHECK(state IN ('ready','recording','paused','completed','interrupted')),
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL, cloud_id TEXT,
 participant_visibility TEXT NOT NULL DEFAULT 'everyone' CHECK(participant_visibility IN ('everyone','organizer_only'))
);
CREATE TABLE recordings (
 id TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
 uri TEXT NOT NULL, duration_ms INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL CHECK(status IN ('recording','paused','completed','interrupted','missing')),
 created_at TEXT NOT NULL, checkpoint_at TEXT NOT NULL
);
CREATE TABLE participants (id TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE, name TEXT NOT NULL, introduction TEXT NOT NULL);
CREATE TABLE speakers (id TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE, label TEXT NOT NULL);
CREATE TABLE speaker_person_links (speaker_id TEXT PRIMARY KEY REFERENCES speakers(id) ON DELETE CASCADE, participant_id TEXT NOT NULL REFERENCES participants(id) ON DELETE CASCADE);
CREATE TABLE transcript_segments (id TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE, recording_id TEXT NOT NULL REFERENCES recordings(id) ON DELETE CASCADE, speaker_id TEXT REFERENCES speakers(id) ON DELETE SET NULL, start_ms INTEGER NOT NULL, end_ms INTEGER NOT NULL, text TEXT NOT NULL);
CREATE TABLE summaries (id TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE, content TEXT NOT NULL, kind TEXT NOT NULL DEFAULT 'private');
CREATE TABLE topics (id TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE, text TEXT NOT NULL);
CREATE TABLE actions (id TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE, text TEXT NOT NULL, completed INTEGER NOT NULL DEFAULT 0);
CREATE TABLE embedding_chunks (id TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE, text TEXT NOT NULL, vector TEXT NOT NULL, model TEXT NOT NULL, start_ms INTEGER NOT NULL, speaker_id TEXT REFERENCES speakers(id) ON DELETE SET NULL);
CREATE TABLE local_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE ai_jobs (id TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE, status TEXT NOT NULL, stage TEXT NOT NULL, remote_task_id TEXT, updated_at TEXT NOT NULL);
CREATE INDEX recordings_session_idx ON recordings(session_id);
CREATE INDEX transcript_session_idx ON transcript_segments(session_id, start_ms);
CREATE INDEX embedding_session_idx ON embedding_chunks(session_id);
`,
  },
  { version: 2, sql: 'ALTER TABLE sessions ADD COLUMN starts_at TEXT;' },
] as const;
export async function migrate(db: MigrationDatabase) {
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  const row = await db.getFirstAsync<{ user_version: number }>(
    'PRAGMA user_version',
  );
  const version = row?.user_version ?? 0;
  if (version > migrations.length)
    throw new Error('本地数据库版本较新，请升级倾盖如故');
  for (const migration of migrations)
    if (migration.version > version) {
      await db.withExclusiveTransactionAsync(async (txn) => {
        await txn.execAsync(migration.sql);
        await txn.execAsync(`PRAGMA user_version = ${migration.version}`);
      });
    }
}
