import { useEffect, useState } from 'react';
import { Text, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Page, Heading, Card, Action, styles } from '../src/ui';
import { processSession, deleteAIResults } from '../src/ai-processing';
import { getDatabase } from '../src/storage/database';
import { syncParticipants } from '../src/cloud';
import { formatDuration } from '@pengtou/shared';
export default function Analysis() {
  const { id, chunk } = useLocalSearchParams<{ id: string; chunk?: string }>();
  const [status, setStatus] = useState('');
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
  async function load() {
    const db = await getDatabase();
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
    }
  }
  useEffect(() => {
    void load().catch(() => setStatus('读取本地结果失败'));
  }, [id, chunk]);
  async function process() {
    if (busy) return;
    setBusy(true);
    try {
      await processSession(id, setStatus);
      await load();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '整理未完成，请重试');
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
      setMatching(null);
      await load();
    } catch {
      setStatus('匹配未保存，请重试');
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
      {status && <Text style={styles.body}>{status}</Text>}
      <Action
        secondary
        label="配置 AI 服务"
        onPress={() => router.push('/ai-settings')}
      />
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
              void match(s.id).catch(() => setStatus('读取参与者失败'))
            }
          />
          {matching === s.id && (
            <>
              <Text style={styles.caption}>
                只在本场匹配，不做长期声纹识别。
              </Text>
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
      {!!segments.length && (
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
                      .catch(() => setStatus('删除失败，请稍后重试')),
                },
              ],
            )
          }
        />
      )}
    </Page>
  );
}
