import { randomUUID } from 'expo-crypto';
import { useEffect, useState } from 'react';
import { Text, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Page, Heading, Card, Action, styles } from '../src/ui';
import { processSession, deleteAIResults } from '../src/ai-processing';
import { getDatabase, recordingsForSession } from '../src/storage/database';
import { syncParticipants } from '../src/cloud';
import { formatDuration } from '@qinggairugu/shared';
import { readAIKey } from '../src/ai-key';
export default function Analysis() {
  const { id, chunk } = useLocalSearchParams<{ id: string; chunk?: string }>();
  const [status, setStatus] = useState('');
  const [statusError, setStatusError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState('');
  const [segments, setSegments] = useState<
    {
      id: string;
      text: string;
      start_ms: number;
      speaker_id: string;
      person: string;
    }[]
  >([]);
  const [speakers, setSpeakers] = useState<
    { id: string; label: string; person: string | null }[]
  >([]);
  const [topics, setTopics] = useState<string[]>([]);
  const [actions, setActions] = useState<string[]>([]);
  const [source, setSource] = useState('');
  const [matching, setMatching] = useState<string | null>(null);
  const [people, setPeople] = useState<{ id: string; name: string }[]>([]);
  const [hasRecordings, setHasRecordings] = useState(false);
  const [recordingsReady, setRecordingsReady] = useState(false);
  const [keyConfigured, setKeyConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  function showStatus(message: string, isError = false) {
    setStatus(message);
    setStatusError(isError);
  }
  async function load() {
    const db = await getDatabase();
    const [recordings, key] = await Promise.all([
      recordingsForSession(id),
      readAIKey(),
    ]);
    setHasRecordings(recordings.length > 0);
    setRecordingsReady(
      recordings.length > 0 &&
        recordings.every((recording) => recording.status === 'completed'),
    );
    setKeyConfigured(!!key);
    const row = await db.getFirstAsync<{ content: string }>(
      "SELECT content FROM summaries WHERE session_id=? AND kind='private'",
      id,
    );
    setSummary(row?.content ?? '');
    setSegments(
      await db.getAllAsync(
        'SELECT t.*,COALESCE(p.name,s.label) AS person FROM transcript_segments t LEFT JOIN speakers s ON s.id=t.speaker_id LEFT JOIN speaker_person_links l ON l.speaker_id=s.id LEFT JOIN participants p ON p.id=l.participant_id WHERE t.session_id=? ORDER BY t.rowid',
        id,
      ),
    );
    setSpeakers(
      await db.getAllAsync(
        'SELECT s.id,s.label,p.name AS person FROM speakers s LEFT JOIN speaker_person_links l ON l.speaker_id=s.id LEFT JOIN participants p ON p.id=l.participant_id WHERE s.session_id=?',
        id,
      ),
    );
    setTopics(
      (
        await db.getAllAsync<{ text: string }>(
          'SELECT text FROM topics WHERE session_id=?',
          id,
        )
      ).map((r) => r.text),
    );
    setActions(
      (
        await db.getAllAsync<{ text: string }>(
          'SELECT text FROM actions WHERE session_id=?',
          id,
        )
      ).map((r) => r.text),
    );
    if (chunk) {
      const source = await db.getFirstAsync<{ text: string }>(
        'SELECT text FROM embedding_chunks WHERE id=? AND session_id=?',
        chunk,
        id,
      );
      setSource(source?.text ?? '');
    } else setSource('');
  }
  useEffect(() => {
    let live = true;
    setLoading(true);
    void load()
      .catch(() => {
        if (live) showStatus('读取本机结果失败，请稍后重试。', true);
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [id, chunk]);
  async function process() {
    if (busy) return;
    setBusy(true);
    showStatus('正在准备整理…');
    try {
      await processSession(id, (message) => showStatus(message));
      await load();
    } catch (error) {
      showStatus(
        error instanceof Error ? error.message : '整理未完成，请重试',
        true,
      );
    } finally {
      setBusy(false);
    }
  }
  async function match(speakerId: string) {
    try {
      await syncParticipants(id);
    } catch {
      /* 离线时仍可匹配已缓存的本场参与者。 */
    }
    const db = await getDatabase();
    const people = await db.getAllAsync<{ id: string; name: string }>(
      'SELECT id,name FROM participants WHERE session_id=?',
      id,
    );
    setPeople(people);
    setMatching(speakerId);
  }
  async function choosePerson(personId: string | null) {
    if (!matching) return;
    try {
      const db = await getDatabase();
      if (personId)
        await db.runAsync(
          'INSERT INTO speaker_person_links(speaker_id,participant_id) SELECT ?,? WHERE EXISTS(SELECT 1 FROM speakers WHERE id=? AND session_id=?) AND EXISTS(SELECT 1 FROM participants WHERE id=? AND session_id=?) ON CONFLICT(speaker_id) DO UPDATE SET participant_id=excluded.participant_id',
          matching,
          personId,
          matching,
          id,
          personId,
          id,
        );
      else
        await db.runAsync(
          'DELETE FROM speaker_person_links WHERE speaker_id=?',
          matching,
        );
      await db.runAsync(
        'UPDATE sessions SET source_version=? WHERE id=?',
        randomUUID(),
        id,
      );
      setMatching(null);
      await load();
    } catch {
      showStatus('匹配未保存，请重试', true);
    }
  }

  return (
    <Page>
      <Heading title="这场聊了什么" subtitle="私人整理，仅保存在本机。" />
      {source && (
        <Card>
          <Text style={styles.label}>引用的原文片段</Text>
          <Text style={styles.body}>{source}</Text>
        </Card>
      )}
      {loading && <Text style={styles.caption}>正在读取本机整理状态…</Text>}
      {!loading && !hasRecordings && (
        <Card>
          <Text style={styles.label}>先留下一段录音</Text>
          <Text style={styles.body}>
            这场还没有录音。录音保存在本机，之后可以再回来整理。
          </Text>
          <Action
            label="查看本场录音"
            onPress={() =>
              router.push({ pathname: '/session/[id]', params: { id } })
            }
          />
        </Card>
      )}
      {!loading && hasRecordings && !recordingsReady && (
        <Card>
          <Text style={styles.label}>先确认录音片段</Text>
          <Text style={styles.body}>
            本场有未完成或曾中断的录音。请先试听并确认保留，再开始 AI 整理。
          </Text>
          <Action
            label="检查本场录音"
            onPress={() =>
              router.push({ pathname: '/session/[id]', params: { id } })
            }
          />
        </Card>
      )}
      {!loading && recordingsReady && !keyConfigured && (
        <Card>
          <Text style={styles.label}>准备好自己的百炼 Key</Text>
          <Text style={styles.body}>
            整理时，录音会从手机直接发送给你配置的阿里云百炼服务临时处理。Key
            保存在本机安全存储。
          </Text>
          <Action
            label="配置百炼 Key"
            onPress={() => router.push('/ai-settings')}
          />
        </Card>
      )}
      {!loading && recordingsReady && keyConfigured && (
        <>
          <Text style={styles.privacyNote}>
            整理会把录音直接发送给你配置的百炼服务；不经过倾盖如故服务器长期保存。继续前请确认现场人员知情。
          </Text>
          <Action
            label={busy ? '正在整理…' : 'AI 整理本场'}
            disabled={busy}
            onPress={() =>
              Alert.alert(
                '使用百炼整理本场？',
                '录音将从手机直接发送给你的百炼服务。临时音频会由百炼按其保留规则处理。',
                [
                  { text: '取消', style: 'cancel' },
                  { text: '开始整理', onPress: () => void process() },
                ],
              )
            }
          />
        </>
      )}
      {!!status && (
        <Text
          accessibilityLiveRegion="polite"
          accessibilityRole={statusError ? 'alert' : undefined}
          style={statusError ? styles.error : styles.statusText}
        >
          {status}
        </Text>
      )}
      {!summary && !loading && recordingsReady && keyConfigured && (
        <Card>
          <Text style={styles.label}>整理结果会保存在本机</Text>
          <Text style={styles.caption}>
            整理完成后，这里会出现摘要、话题、行动项和发言人。共享回顾需要你另行检查并发布。
          </Text>
        </Card>
      )}
      {summary && (
        <>
          <Card>
            <Text style={styles.label}>摘要</Text>
            <Text style={styles.body}>{summary}</Text>
          </Card>
          <Card>
            <Text style={styles.label}>主要话题</Text>
            {topics.map((t, i) => (
              <Text key={i} style={styles.body}>
                · {t}
              </Text>
            ))}
            <Text style={styles.label}>行动项</Text>
            {actions.map((a, i) => (
              <Text key={i} style={styles.body}>
                · {a}
              </Text>
            ))}
          </Card>
          <Action
            secondary
            label="编辑这场回顾"
            onPress={() => router.push({ pathname: '/recap', params: { id } })}
          />
          <Action
            secondary
            label="选择文字同步到我的小程序"
            accessibilityHint="仅同步你选中的文字，不会发布给本场参与者"
            onPress={() =>
              router.push({ pathname: '/private-sync', params: { id } })
            }
          />
        </>
      )}
      {speakers.map((s) => (
        <Card key={s.id}>
          <Text style={styles.label}>
            {s.label} → {s.person ?? '暂不确定'}
          </Text>
          <Action
            secondary
            label="匹配本场参与者"
            disabled={busy}
            onPress={() =>
              void match(s.id).catch(() => showStatus('读取参与者失败', true))
            }
          />
          {matching === s.id && (
            <>
              <Text style={styles.caption}>
                只在本场匹配，不做长期声纹识别。
              </Text>
              {!people.length && (
                <Text style={styles.caption}>
                  本场还没有参与者资料。可以先生成加入码邀请大家介绍自己。
                </Text>
              )}
              {people.map((person) => (
                <Action
                  key={person.id}
                  secondary
                  label={person.name}
                  onPress={() => void choosePerson(person.id)}
                />
              ))}
              <Action
                secondary
                label="暂不确定"
                onPress={() => void choosePerson(null)}
              />
              <Action
                secondary
                label="收起"
                onPress={() => setMatching(null)}
              />
            </>
          )}
        </Card>
      ))}
      {segments.map((s) => (
        <Card key={s.id}>
          <Text style={styles.caption}>
            {s.person} · {formatDuration(s.start_ms)}
          </Text>
          <Text style={styles.body}>{s.text}</Text>
        </Card>
      ))}
      {!!(segments.length || summary || topics.length || actions.length) && (
        <Action
          secondary
          label="删除 AI 结果"
          disabled={busy}
          onPress={() =>
            Alert.alert(
              '删除私人 AI 结果？',
              '录音文件会保留。已经发布的共享回顾不受影响。',
              [
                { text: '取消', style: 'cancel' },
                {
                  text: '删除',
                  style: 'destructive',
                  onPress: () =>
                    void deleteAIResults(id)
                      .then(load)
                      .catch(() => showStatus('删除失败，请稍后重试', true)),
                },
              ],
            )
          }
        />
      )}
    </Page>
  );
}
