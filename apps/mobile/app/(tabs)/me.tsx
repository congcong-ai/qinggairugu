import { LocalMediaNotice } from '../../src/local-media-notice';
import { router } from 'expo-router';
import { Text } from 'react-native';
import { Page, Heading, Card, Action, styles } from '../../src/ui';
export default function Screen() {
  return (
    <Page>
      <Heading title="我的" subtitle="你的记录，由你掌握。" />
      <LocalMediaNotice />
      <Card>
        <Text style={styles.body}>
          录音原文件长期保存在你的设备。AI 整理时会临时发送给你配置的 AI
          服务处理。
        </Text>
      </Card>
      <Action label="关联我的小程序" onPress={() => router.push('/binding')} />
      <Action label="AI 服务" onPress={() => router.push('/ai-settings')} />
    </Page>
  );
}
