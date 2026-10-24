import { bindingStatus, cloudRequest, cloudSessionId } from './cloud';
import { getDatabase } from './storage/database';
import { activeAIJobs } from './activity';
import type { PrivateAIInput } from '@pengtou/contracts';
export async function syncState(id: string) {
  const state = await bindingStatus();
  const binding = state.bindings[0];
  if (!binding) throw new Error('请先在「我的」关联小程序');
  const local = await (
    await getDatabase()
  ).getFirstAsync<{ source_version: string | null }>(
    'SELECT source_version FROM sessions WHERE id=?',
    id,
  );
  const remote = await cloudRequest<{
    id: string | null;
    version: number;
    fields: PrivateAIInput['fields'];
    sourceVersion: string | null;
    deleted: boolean;
  }>(`/me/private-ai/state/${id}`);
  return {
    binding,
    hasNewVersion: !!(
      remote.id &&
      !remote.deleted &&
      (local?.source_version ?? 'legacy') !== remote.sourceVersion
    ),
    remote,
  };
}
export async function syncPrivateAI(
  id: string,
  fields: PrivateAIInput['fields'],
) {
  if (activeAIJobs.has(id)) throw new Error('请等待整理完成后再同步');
  const { binding, remote } = await syncState(id);
  const db = await getDatabase();
  const session = await db.getFirstAsync<{
    title: string;
    cloud_id: string | null;
    source_version: string | null;
  }>('SELECT * FROM sessions WHERE id=?', id);
  if (!session) throw new Error('记录不存在');
  const summary = await db.getFirstAsync<{ content: string }>(
    "SELECT content FROM summaries WHERE session_id=? AND kind='private'",
    id,
  );
  if (!summary) throw new Error('请先在 App 完成 AI 整理');
  const content: PrivateAIInput['content'] = {};
  if (fields.includes('summary')) content.summary = summary.content;
  for (const key of ['topics', 'actions'] as const)
    if (fields.includes(key))
      content[key] = (
        await db.getAllAsync<{ text: string }>(
          `SELECT text FROM ${key} WHERE session_id=?`,
          id,
        )
      ).map((x) => x.text);
  if (fields.includes('speakers'))
    content.speakers = await db.getAllAsync(
      'SELECT s.id,COALESCE(p.name,s.label) AS label FROM speakers s LEFT JOIN speaker_person_links l ON l.speaker_id=s.id LEFT JOIN participants p ON p.id=l.participant_id WHERE s.session_id=?',
      id,
    );
  if (fields.includes('transcript'))
    content.transcript = await db.getAllAsync(
      'SELECT id,speaker_id AS speakerId,start_ms AS startMs,end_ms AS endMs,text FROM transcript_segments WHERE session_id=? ORDER BY rowid',
      id,
    );
  const input: PrivateAIInput = {
    bindingId: binding.id,
    localSessionId: id,
    sessionId: session.cloud_id ? await cloudSessionId(id) : null,
    title: session.title,
    sourceVersion: session.source_version ?? 'legacy',
    version: remote.version,
    fields,
    content,
  };
  const result = await cloudRequest<{ id: string; version: number }>(
    '/me/private-ai',
    'PUT',
    input,
  );
  await db.runAsync(
    'INSERT INTO ai_sync_state(session_id,binding_id,remote_id,remote_version,source_version,fields) VALUES(?,?,?,?,?,?) ON CONFLICT(session_id) DO UPDATE SET binding_id=excluded.binding_id,remote_id=excluded.remote_id,remote_version=excluded.remote_version,source_version=excluded.source_version,fields=excluded.fields',
    id,
    binding.id,
    result.id,
    result.version,
    input.sourceVersion,
    JSON.stringify(fields),
  );
  return result;
}
export async function revokePrivateAI(id: string) {
  const db = await getDatabase();
  const local = await db.getFirstAsync<{
    remote_id: string | null;
    binding_id: string;
  }>('SELECT remote_id,binding_id FROM ai_sync_state WHERE session_id=?', id);
  if (local?.remote_id) {
    await db.withExclusiveTransactionAsync(async (tx) => {
      await tx.runAsync(
        'INSERT OR IGNORE INTO pending_operations(id,kind,target_id,binding_id,created_at) VALUES(?,?,?,?,?)',
        `revoke:${local.remote_id}`,
        'private-ai-delete',
        local.remote_id,
        local.binding_id,
        new Date().toISOString(),
      );
      await tx.runAsync('DELETE FROM ai_sync_state WHERE session_id=?', id);
    });
    try {
      await bindingStatus();
      return { queued: false };
    } catch {
      return { queued: true };
    }
  }
  const { remote } = await syncState(id);
  if (remote.id) await cloudRequest(`/me/private-ai/${remote.id}`, 'DELETE');
  return { queued: false };
}
