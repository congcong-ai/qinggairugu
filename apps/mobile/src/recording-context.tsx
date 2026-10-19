import { activeAIJobs } from './activity';
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import { AppState } from 'react-native';
import {
  AudioModule,
  type RecordingOptions,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { Paths, File } from 'expo-file-system';
import { randomUUID } from 'expo-crypto';
import { defaultSessionTitle } from '@pengtou/shared';
import { getDatabase } from './storage/database';

type Status = 'idle' | 'recording' | 'paused' | 'interrupted';
interface Active {
  sessionId: string;
  recordingId: string;
  title: string;
}
interface RecordingContextValue {
  active: Active | null;
  status: Status;
  duration: number;
  metering: number;
  busy: boolean;
  error: string | null;
  start: (sessionId?: string) => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  finish: () => Promise<void>;
}
const Context = createContext<RecordingContextValue | null>(null);
export function useRecording() {
  const value = useContext(Context);
  if (!value) throw new Error('录音上下文未初始化');
  return value;
}
export function RecordingProvider({ children }: PropsWithChildren) {
  const [active, setActive] = useState<Active | null>(null);
  const activeRef = useRef<Active | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const statusRef = useRef<Status>('idle');
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const stopping = useRef(false);
  const checkpointQueue = useRef<Promise<void>>(Promise.resolve());
  const recordingOptions: RecordingOptions = {
    ...RecordingPresets.HIGH_QUALITY,
    directory: 'document',
    extension: '.aac',
    numberOfChannels: 1,
    bitRate: 64000,
    android: { outputFormat: 'aac_adts', audioEncoder: 'aac' },
    isMeteringEnabled: true,
  };
  const recorder = useAudioRecorder(recordingOptions, (event) => {
    if (
      (event.hasError || event.isFinished) &&
      !stopping.current &&
      activeRef.current
    ) {
      statusRef.current = 'interrupted';
      setStatus('interrupted');
      setError('录音被中断，已有文件会保留。完成保存后可以继续录制新的一段。');
    }
  });
  const state = useAudioRecorderState(recorder, 250);
  function updateStatus(next: Status) {
    statusRef.current = next;
    setStatus(next);
  }
  async function checkpoint(
    next: Exclude<Status, 'idle'> | 'completed' = statusRef.current === 'idle'
      ? 'interrupted'
      : statusRef.current,
  ) {
    const current = activeRef.current;
    if (!current) return;
    const elapsed = recorder.getStatus().durationMillis;
    const now = new Date().toISOString();
    const pending = checkpointQueue.current
      .catch(() => {})
      .then(async () => {
        const db = await getDatabase();
        await db.withExclusiveTransactionAsync(async (txn) => {
          await txn.runAsync(
            'UPDATE recordings SET duration_ms = MAX(duration_ms, ?), status = ?, checkpoint_at = ? WHERE id = ?',
            elapsed,
            next,
            now,
            current.recordingId,
          );
          await txn.runAsync(
            'UPDATE sessions SET state = ?, updated_at = ? WHERE id = ?',
            next,
            now,
            current.sessionId,
          );
        });
      });
    checkpointQueue.current = pending;
    await pending;
  }

  async function run(action: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (error) {
      if (__DEV__)
        console.warn(
          '录音操作失败',
          error instanceof Error ? error.message : '未知录音错误',
        );
      setError(
        '操作没有完成，请检查麦克风权限与设备空间后重试。已有录音不会自动删除。',
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  const start = (existingId?: string) =>
    run(async () => {
      if (activeRef.current) return;
      if (existingId && activeAIJobs.has(existingId)) {
        setError('这场正在进行 AI 整理，请完成后再追加录音');
        return;
      }
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (!permission.granted) {
        setError('需要麦克风权限才能开始记录，请在系统设置中允许。');
        return;
      }
      if (Paths.availableDiskSpace < 50 * 1024 * 1024) {
        setError('设备空间不足，请至少预留 50 MB 后再开始。');
        return;
      }
      await AudioModule.requestNotificationPermissionsAsync();
      await setAudioModeAsync({
        allowsRecording: true,
        allowsBackgroundRecording: true,
        playsInSilentMode: true,
        interruptionMode: 'doNotMix',
      });
      const db = await getDatabase();
      const now = new Date().toISOString();
      const sessionId = existingId ?? randomUUID();
      const recordingId = randomUUID();
      const existing = existingId
        ? await db.getFirstAsync<{ title: string }>(
            'SELECT title FROM sessions WHERE id = ?',
            existingId,
          )
        : null;
      if (existingId && !existing) throw new Error('记录不存在');
      const title = existing?.title ?? defaultSessionTitle();
      // 文件名固定为录音 ID，prepare 前预写索引，避免崩溃留下无法关联的孤儿文件。
      const uri = new File(Paths.document, 'Audio', `${recordingId}.aac`).uri;
      await db.withExclusiveTransactionAsync(async (txn) => {
        if (!existingId)
          await txn.runAsync(
            'INSERT INTO sessions(id,title,state,created_at,updated_at) VALUES(?,?,?,?,?)',
            sessionId,
            title,
            'ready',
            now,
            now,
          );
        await txn.runAsync(
          'INSERT INTO recordings(id,session_id,uri,status,created_at,checkpoint_at) VALUES(?,?,?,?,?,?)',
          recordingId,
          sessionId,
          uri,
          'interrupted',
          now,
          now,
        );
      });
      try {
        await recorder.prepareToRecordAsync({
          ...recordingOptions,
          fileName: recordingId,
        });
        if (!recorder.uri) throw new Error('录音文件未创建');
        await db.runAsync(
          'UPDATE recordings SET uri = ? WHERE id = ?',
          recorder.uri,
          recordingId,
        );
        activeRef.current = { sessionId, recordingId, title };
        setActive(activeRef.current);
        recorder.record();
        updateStatus('recording');
        await checkpoint('recording');
      } catch (error) {
        updateStatus('interrupted');
        await db.runAsync(
          "UPDATE sessions SET state = 'interrupted' WHERE id = ?",
          sessionId,
        );
        throw error;
      }
    });
  const pause = () =>
    run(async () => {
      if (statusRef.current !== 'recording') return;
      recorder.pause();
      updateStatus('paused');
      await checkpoint('paused');
    });
  const resume = () =>
    run(async () => {
      if (statusRef.current !== 'paused') return;
      if (Paths.availableDiskSpace < 50 * 1024 * 1024)
        throw new Error('空间不足');
      recorder.record();
      updateStatus('recording');
      await checkpoint('recording');
    });
  const finish = () =>
    run(async () => {
      if (!activeRef.current) return;
      stopping.current = true;
      try {
        await checkpoint();
        if (statusRef.current === 'interrupted') {
          try {
            await recorder.stop();
          } catch {
            /* 系统可能已经释放录音器；保留中断文件。 */
          }
        } else await recorder.stop();
        const uri = recorder.uri;
        if (!uri || !new File(uri).exists || new File(uri).size === 0) {
          await checkpoint('interrupted');
          activeRef.current = null;
          setActive(null);
          updateStatus('idle');
          throw new Error('音频文件不存在或为空');
        }
        // 被中断的文件保留中断标记，不能仅因为文件存在就宣称完整。
        await checkpoint(
          statusRef.current === 'interrupted' ? 'interrupted' : 'completed',
        );
        activeRef.current = null;
        setActive(null);
        updateStatus('idle');
        await setAudioModeAsync({
          allowsRecording: false,
          allowsBackgroundRecording: false,
        });
      } finally {
        stopping.current = false;
      }
    });
  const checkpointRef = useRef(checkpoint);
  checkpointRef.current = checkpoint;
  const finishRef = useRef(finish);
  finishRef.current = finish;
  useEffect(() => {
    const save = () => {
      if (activeRef.current && !lock.current)
        void checkpointRef
          .current()
          .catch(() =>
            setError('保存进度失败，请尽快完成录音并检查设备空间。'),
          );
    };
    const interval = setInterval(() => {
      if (
        activeRef.current &&
        !lock.current &&
        statusRef.current === 'recording' &&
        !recorder.getStatus().isRecording
      ) {
        updateStatus('interrupted');
        setError('录音被系统中断，已有文件会保留。');
      }
      save();
      if (activeRef.current && Paths.availableDiskSpace < 10 * 1024 * 1024)
        void finishRef.current();
    }, 5000);
    const subscription = AppState.addEventListener('change', () => save());
    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, []);
  useEffect(() => {
    if (
      activeRef.current &&
      statusRef.current === 'recording' &&
      !state.isRecording &&
      !lock.current
    ) {
      updateStatus('interrupted');
      setError('录音被系统中断，已保留现有文件。');
      void checkpointRef
        .current('interrupted')
        .catch(() => setError('中断进度保存失败，重启后会尝试找回录音。'));
    }
  }, [state.isRecording]);
  return (
    <Context.Provider
      value={{
        active,
        status,
        duration: state.durationMillis,
        metering: state.metering ?? -60,
        busy,
        error,
        start,
        pause,
        resume,
        finish,
      }}
    >
      {children}
    </Context.Provider>
  );
}
