import { useState, useEffect } from 'react';
import { Text, Switch, Alert, View } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Page, Heading, Card, Action, styles } from '../src/ui';
import { syncPrivateAI, revokePrivateAI, syncState } from '../src/private-sync';
import type { PrivateAIInput } from '@pengtou/contracts';
export default function Sync() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [fields, setFields] = useState<PrivateAIInput['fields']>([
    'summary',
    'topics',
    'actions',
    'speakers',
  ]);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void syncState(id)
      .then((s) => {
        if (!s.remote.deleted && s.remote.fields.length)
          setFields(s.remote.fields);
        setStatus(
          s.remote.deleted
            ? '上次云端副本已删除。重新同步需再次确认。'
            : s.hasNewVersion
              ? '本机有新版本待同步，云端仍是上次确认的内容。请核对范围后再同步。'
              : s.remote.id
                ? '已有云端副本，可更新或撤销。'
                : '尚未同步。',
        );
      })
      .catch((e) => setStatus(e.message));
  }, [id]);
  async function run(remove = false) {
    setBusy(true);
    try {
      if (remove) {
        const result = await revokePrivateAI(id);
        if (result.queued) {
          setStatus(
            '撤销请求已在本机排队；联网后打开我的活动会重试。云端副本在撤销成功前仍可能可见。',
          );
          return;
        }
      } else await syncPrivateAI(id, fields);
      setStatus(
        remove
          ? '已删除云端副本，本地原件保留。'
          : '已同步，打开本人小程序「我的整理结果」查看。',
      );
    } catch (e) {
      setStatus(e instanceof Error ? e.message : '未完成');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Page>
      <Heading title="同步到我的小程序" subtitle="只有我可见" />
      <Card>
        <Text style={styles.body}>
          仅上传下方选择的文字，保存于产品云端。录音、向量索引和百炼 Key
          不会上传。全文可能包含他人敏感谈话，请谨慎选择。
        </Text>
        {(
          ['summary', 'topics', 'actions', 'speakers', 'transcript'] as const
        ).map((key) => (
          <View
            key={key}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Text style={styles.label}>
              {
                {
                  summary: 'AI 摘要',
                  topics: '主要话题',
                  actions: '行动项',
                  speakers: '发言人标签',
                  transcript: '完整转写（单独选择）',
                }[key]
              }
            </Text>
            <Switch
              value={fields.includes(key)}
              onValueChange={(v) =>
                setFields((old) =>
                  v ? [...old, key] : old.filter((x) => x !== key),
                )
              }
            />
          </View>
        ))}
      </Card>
      <Action
        label="确认范围并同步"
        disabled={busy || !fields.length}
        onPress={() =>
          Alert.alert(
            '同步这些文字？',
            '仅你的已关联微信身份可查看。这不会发布本场共享回顾。',
            [
              { text: '再看看', style: 'cancel' },
              { text: '确认同步', onPress: () => void run() },
            ],
          )
        }
      />
      <Action
        secondary
        label="取消同步并删除云端副本"
        disabled={busy}
        onPress={() =>
          Alert.alert('删除云端副本？', '本机原件保留。', [
            { text: '取消', style: 'cancel' },
            {
              text: '删除',
              style: 'destructive',
              onPress: () => void run(true),
            },
          ])
        }
      />
      <Action
        secondary
        label="关联我的小程序"
        onPress={() => router.push('/binding')}
      />
      <Text style={styles.caption}>{status}</Text>
    </Page>
  );
}
