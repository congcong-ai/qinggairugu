import { router } from 'expo-router';
import { Page, Heading, Card, Action, styles } from '../src/ui';
import { Text } from 'react-native';
export default function Start() {
  return (
    <Page>
      <Heading title="记录一场活动" subtitle="这一次，你以什么身份记录？" />
      <Card>
        <Action
          label="我是发起人"
          onPress={() =>
            router.replace({
              pathname: '/recording',
              params: { role: 'organizer' },
            })
          }
        />
        <Text style={styles.caption}>
          直接开始记录，下方加入码可用于邀请大家。
        </Text>
        <Action
          secondary
          label="我是参与者"
          onPress={() =>
            router.replace({
              pathname: '/recording',
              params: { role: 'participant' },
            })
          }
        />
        <Text style={styles.caption}>
          直接记录自己的见闻，内容只有自己可见。
        </Text>
      </Card>
    </Page>
  );
}
