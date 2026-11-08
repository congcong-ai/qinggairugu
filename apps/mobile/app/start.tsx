import { router } from 'expo-router';
import { Platform, Text } from 'react-native';
import { Page, Heading, Card, Action, styles } from '../src/ui';

export default function Start() {
  return (
    <Page>
      <Heading
        title="选择一种开始方式"
        subtitle="每条路都会先把内容保存在本机。"
      />
      <Card>
        <Text style={styles.label}>现在就开始</Text>
        <Text style={styles.body}>
          现场已经开始？直接录音，之后再邀请大家加入。
        </Text>
        <Action
          label="开始记录，稍后再邀请"
          onPress={() =>
            router.replace({
              pathname: '/recording',
              params: { role: 'organizer' },
            })
          }
        />
      </Card>
      <Card>
        <Text style={styles.label}>提前准备</Text>
        <Text style={styles.body}>
          先创建一场并设置参与者资料的可见范围，见面时再开始录音。
        </Text>
        <Action
          secondary
          label="提前创建一场"
          onPress={() => router.push('/create')}
        />
      </Card>
      {Platform.OS === 'android' ? (
        <Card>
          <Text style={styles.label}>已经拿到活动编号？</Text>
          <Text style={styles.body}>
            关联本人小程序后，可用编号加入活动。参与者也可以直接在微信里扫码加入。
          </Text>
          <Action
            secondary
            label="加入已有活动"
            onPress={() => router.push('/activity-join')}
          />
        </Card>
      ) : (
        <Text style={styles.caption}>
          iOS 版暂未开放微信连接。参与者可在微信小程序中扫码加入。
        </Text>
      )}
    </Page>
  );
}
