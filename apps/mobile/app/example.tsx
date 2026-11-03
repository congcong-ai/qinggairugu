import { useState } from 'react';
import { Text, TextInput } from 'react-native';
import { Page, Heading, Card, Action, styles } from '../src/ui';
import { exampleSession, searchExample } from '../src/example-experience';
export default function ExampleExperience() {
  const [view, setView] = useState<
    'summary' | 'transcript' | 'search' | 'recap'
  >('summary');
  const [query, setQuery] = useState('锁屏录音');
  const [searched, setSearched] = useState('锁屏录音');
  const [source, setSource] = useState<string | null>(null);
  const hits = searchExample(searched);
  return (
    <Page>
      <Heading title="先看看示例" subtitle="不用登录，也不用配置 AI Key。" />
      <Card>
        <Text style={styles.label}>这是预先编写的示例数据</Text>
        <Text style={styles.body}>
          用一场虚构的交流，看看整理、发言人、行动项和来源搜索是什么样。此处不进行真实转写或
          AI 推理，不上传内容，也不写入你的记录。真实录音整理仍需你主动配置百炼
          Key；云端加入和同步仍需微信授权。
        </Text>
      </Card>
      <Text style={styles.label}>{exampleSession.title}</Text>
      {(
        [
          ['summary', '整理结果'],
          ['transcript', '发言人与原文'],
          ['search', '搜索与来源'],
          ['recap', '共享回顾草稿'],
        ] as const
      ).map(([key, label]) => (
        <Action
          key={key}
          secondary
          label={`${view === key ? '✓ ' : ''}${label}`}
          onPress={() => setView(key)}
        />
      ))}
      {view === 'summary' && (
        <>
          <Card>
            <Text style={styles.label}>这场聊了什么 · 示例</Text>
            <Text style={styles.body}>{exampleSession.summary}</Text>
          </Card>
          <Card>
            <Text style={styles.label}>主要话题</Text>
            <Text style={styles.body}>{exampleSession.topics.join(' · ')}</Text>
          </Card>
          <Card>
            <Text style={styles.label}>接下来可以做</Text>
            {exampleSession.actions.map((text) => (
              <Text key={text} style={styles.body}>
                {text}
              </Text>
            ))}
          </Card>
        </>
      )}
      {view === 'transcript' &&
        exampleSession.segments.map((segment) => (
          <Card key={segment.id}>
            <Text style={styles.label}>
              {segment.speaker} · {segment.time}
              {source === segment.id ? ' · 当前引用' : ''}
            </Text>
            <Text style={styles.body}>{segment.text}</Text>
          </Card>
        ))}
      {view === 'search' && (
        <>
          <Card>
            <Text style={styles.label}>在示例原文中找一找</Text>
            <TextInput
              accessibilityLabel="搜索示例"
              style={{ fontSize: 20, minHeight: 60 }}
              value={query}
              onChangeText={setQuery}
              maxLength={200}
              placeholder="例如：锁屏录音、试用、行动安排"
            />
            <Action
              label="搜索示例"
              disabled={!query.trim()}
              onPress={() => setSearched(query.trim())}
            />
            <Text style={styles.caption}>
              离线关键词搜索示例，不调用
              AI；真实“问倾盖如故”使用你配置的百炼服务。
            </Text>
          </Card>
          {hits.length === 0 && (
            <Card>
              <Text style={styles.body}>
                示例中没有匹配的原文。试试“锁屏录音”“试用”或“行动安排”。
              </Text>
            </Card>
          )}
          {hits.map((segment) => (
            <Card key={segment.id}>
              <Text style={styles.label}>
                {segment.speaker} · {segment.time}
              </Text>
              <Text style={styles.body}>{segment.text}</Text>
              <Action
                secondary
                label="查看引用原文"
                onPress={() => {
                  setSource(segment.id);
                  setView('transcript');
                }}
              />
            </Card>
          ))}
        </>
      )}
      {view === 'recap' && (
        <Card>
          <Text style={styles.label}>这场回顾 · 示例草稿</Text>
          <Text style={styles.body}>{exampleSession.summary}</Text>
          <Text style={styles.body}>
            下一步：完成可靠性测试，邀请组织者试用。
          </Text>
          <Text style={styles.caption}>
            这只是离线示例，不会发布。真实回顾需要主办方查看并主动确认发布；私人原文不会自动公开。
          </Text>
        </Card>
      )}
    </Page>
  );
}
