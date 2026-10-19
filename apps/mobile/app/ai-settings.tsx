import { useEffect, useState } from 'react';
import { Text, TextInput } from 'react-native';
import { Page, Heading, Card, Action, styles } from '../src/ui';
import { readAIKey, saveAIKey, deleteAIKey } from '../src/ai-key';
import { BailianProvider } from '@pengtou/ai';
export default function AISettings() {
  const [key, setKey] = useState('');
  const [configured, setConfigured] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  useEffect(() => {
    void readAIKey()
      .then((v) => setConfigured(!!v))
      .catch(() => setNotice('无法读取安全存储'));
  }, []);
  async function action(kind: 'test' | 'save' | 'delete') {
    if (busy) return;
    setBusy(true);
    try {
      if (kind === 'delete') {
        await deleteAIKey();
        setConfigured(false);
        setKey('');
        setNotice('已删除 API Key');
      } else if (kind === 'save') {
        await saveAIKey(key);
        setConfigured(true);
        setKey('');
        setNotice('API Key 已安全保存');
      } else {
        const value = key.trim() || (await readAIKey());
        if (!value) {
          setNotice('请先填写 API Key');
          return;
        }
        await new BailianProvider(value).testConnection();
        setNotice('连接成功');
      }
    } catch {
      setNotice('操作未完成，请检查 Key、北京地域与网络后重试');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Page>
      <Heading title="AI 服务" subtitle="使用你自己的阿里云百炼。" />
      <Card>
        <Text style={styles.label}>阿里云百炼 · 北京地域</Text>
        <Text style={styles.body}>
          {configured ? 'API Key 已配置' : '尚未配置 API Key'}
        </Text>
        <TextInput
          accessibilityLabel="百炼 API Key"
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          value={key}
          onChangeText={setKey}
          placeholder={configured ? '输入新的 Key 以更换' : '粘贴 API Key'}
          style={{
            padding: 16,
            borderWidth: 1,
            borderColor: '#E2E5DB',
            borderRadius: 14,
          }}
        />
        <Action
          label="测试连接"
          disabled={busy}
          onPress={() => void action('test')}
        />
        <Action
          secondary
          label="保存"
          disabled={busy || !key.trim()}
          onPress={() => void action('save')}
        />
        {configured && (
          <Action
            secondary
            label="删除 Key"
            disabled={busy}
            onPress={() => void action('delete')}
          />
        )}
        <Text style={styles.caption}>{notice}</Text>
      </Card>
      <Text style={styles.body}>
        Key 仅保存在设备安全存储中，不会发送到倾盖如故服务器。AI
        处理由你的百炼账户承担用量。
      </Text>
    </Page>
  );
}
