import * as DocumentPicker from 'expo-document-picker';
import { File, Directory, Paths } from 'expo-file-system';
import { createAudioPlayer } from 'expo-audio';
import { randomUUID } from 'expo-crypto';
import { Alert } from 'react-native';
import { getDatabase } from './storage/database';
import { activeAIJobs, activeAudioImports } from './activity';
export async function importAudio(sessionId: string) {
  if (activeAudioImports.has(sessionId))
    throw new Error('这场正在导入录音，请稍候');
  activeAudioImports.add(sessionId);
  try {
    return await selectAndImport(sessionId);
  } finally {
    activeAudioImports.delete(sessionId);
  }
}
async function selectAndImport(sessionId: string) {
  if (activeAIJobs.has(sessionId)) throw new Error('请等待 AI 整理完成');
  const db = await getDatabase();
  if (
    await db.getFirstAsync(
      "SELECT id FROM recordings WHERE session_id=? AND status IN ('recording','paused')",
      sessionId,
    )
  )
    throw new Error('请先完成当前录音');
  const result = await DocumentPicker.getDocumentAsync({
    type: ['audio/*', 'application/octet-stream'],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled) return;
  const asset = result.assets[0]!;
  const source = new File(asset.uri);
  try {
    const ext = asset.name.split('.').pop()?.toLowerCase();
    const formats: Record<string, string> = {
      m4a: 'audio/mp4',
      mp3: 'audio/mpeg',
      wav: 'audio/wav',
    };
    const mime = formats[ext ?? ''];
    if (!mime) throw new Error('当前支持 m4a、mp3、wav，请选择原始音频文件');
    if (!source.exists || !source.size || source.size > 200 * 1024 * 1024)
      throw new Error('文件为空或超过 200 MiB');
    if (Paths.availableDiskSpace < source.size + 50 * 1024 * 1024)
      throw new Error('设备空间不足，请预留文件大小及至少 50 MiB');
    const player = createAudioPlayer(source.uri);
    let duration = 0;
    try {
      for (let i = 0; i < 100 && !player.isLoaded; i++)
        await new Promise((r) => setTimeout(r, 100));
      duration = player.duration;
      if (!player.isLoaded || !Number.isFinite(duration) || duration <= 0)
        throw new Error('文件无法解码，请确认录音完整');
      if (duration > 7200) throw new Error('当前每段支持 2 小时以内的录音');
    } finally {
      player.remove();
    }
    const fingerprint = source.md5;
    if (
      fingerprint &&
      (await db.getFirstAsync(
        'SELECT id FROM recordings WHERE fingerprint=?',
        fingerprint,
      ))
    ) {
      const yes = await new Promise<boolean>((resolve) =>
        Alert.alert(
          '这个文件以前导入过',
          '仍然导入为独立片段？不会合并或删除已有录音。',
          [
            { text: '取消', onPress: () => resolve(false), style: 'cancel' },
            { text: '继续导入', onPress: () => resolve(true) },
          ],
          { cancelable: true, onDismiss: () => resolve(false) },
        ),
      );
      if (!yes) return;
    }
    const id = randomUUID();
    const directory = new Directory(Paths.document, 'Audio');
    directory.create({ intermediates: true, idempotent: true });
    const target = new File(directory, `${id}.${ext}`);
    const now = new Date().toISOString();
    await db.runAsync(
      "INSERT INTO recordings(id,session_id,uri,duration_ms,status,created_at,checkpoint_at,source,mime,bytes,fingerprint,import_state) VALUES(?,?,?,?,'interrupted',?,?,'imported',?,?,?,'copying')",
      id,
      sessionId,
      target.uri,
      Math.round(duration * 1000),
      now,
      now,
      mime,
      source.size,
      fingerprint,
    );
    try {
      await source.copy(target);
      if (
        !target.exists ||
        target.size !== source.size ||
        !fingerprint ||
        target.md5 !== fingerprint
      )
        throw new Error('文件复制校验失败');
      await db.withExclusiveTransactionAsync(async (tx) => {
        await tx.runAsync(
          "UPDATE recordings SET status='completed',import_state='ready' WHERE id=?",
          id,
        );
        await tx.runAsync(
          "UPDATE sessions SET state='completed',updated_at=? WHERE id=?",
          new Date().toISOString(),
          sessionId,
        );
      });
    } catch (error) {
      if (target.exists) target.delete();
      await db.runAsync(
        "UPDATE recordings SET import_state='failed',status='missing' WHERE id=?",
        id,
      );
      throw error;
    }
    return id;
  } finally {
    // 仅清除系统选择器生成的缓存副本，不删除录音机原文件。
    if (source.uri.startsWith(Paths.cache.uri) && source.exists) {
      try {
        source.delete();
      } catch {
        /* 系统稍后回收缓存，不影响已保存原件。 */
      }
    }
  }
}
