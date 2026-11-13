import { useState } from 'react';
import { Text } from 'react-native';
import { router } from 'expo-router';
import {
  AIContentLabel,
  Page,
  Heading,
  Card,
  Action,
  Field,
  styles,
} from '../src/ui';
import { askLocal } from '../src/ai-processing';
import { formatDuration } from '@qinggairugu/shared';
export default function Search() {
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Awaited<
    ReturnType<typeof askLocal>
  > | null>(null);
  const [error, setError] = useState('');
  async function search() {
    if (busy || !query.trim()) return;
    setBusy(true);
    setError('');
    try {
      setResult(await askLocal(query.trim()));
    } catch (e) {
      setError(e instanceof Error ? e.message : '搜索失败，请重试');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Page>
      <Heading title="问倾盖如故" subtitle="找回那些聊过的事。" />
      <Card>
        <Field
          label="想找回什么？"
          placeholder="之前在哪场聊过 AI 硬件？"
          value={query}
          editable={!busy}
          onChangeText={(value) => {
            setQuery(value);
            if (result) setResult(null);
            setError('');
          }}
          maxLength={500}
          multiline
          style={{ minHeight: 92, fontSize: 18 }}
        />
        <Action
          label={busy ? '正在找…' : '找一找'}
          disabled={busy || !query.trim()}
          onPress={() => void search()}
        />
        <Text style={styles.caption}>
          仅搜索本机历史。问题和检索到的片段将由你配置的百炼服务生成回答。
        </Text>
        <Action
          secondary
          label="管理百炼 Key"
          onPress={() => router.push('/ai-settings')}
        />
      </Card>
      {!result && !query && (
        <Card>
          <Text style={styles.label}>也可以这样问</Text>
          {['记录里提到了哪些话题？', '有哪些行动项？'].map((question) => (
            <Action
              key={question}
              secondary
              label={question}
              onPress={() => setQuery(question)}
            />
          ))}
        </Card>
      )}
      {error && (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}
      {result && (
        <Card>
          <AIContentLabel label="AI生成回答" />
          <Text style={styles.body}>{result.answer}</Text>
        </Card>
      )}
      {result?.sources.map((source, i) => (
        <Card key={source.id}>
          <AIContentLabel label="AI生成转写" />
          <Text style={styles.label}>
            [{i + 1}] {source.title}
          </Text>
          <Text style={styles.caption}>
            {source.createdAt.slice(0, 10)} · {source.person} ·{' '}
            {formatDuration(source.startMs)}
          </Text>
          <Text style={styles.body}>{source.text}</Text>
          <Action
            secondary
            label="查看原文"
            onPress={() =>
              router.push({
                pathname: '/analysis',
                params: { id: source.sessionId, chunk: source.id },
              })
            }
          />
        </Card>
      ))}
    </Page>
  );
}
