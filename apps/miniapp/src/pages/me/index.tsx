import { AppGuide } from '../../components/app-guide';
import { View, Text, Button } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { login, request, message } from '../../lib/api';
export default function Me() {
  async function remove() {
    const result = await Taro.showModal({
      title: '删除保存资料？',
      content: '以后不会再自动填入。已加入的每场资料快照会保留。',
    });
    if (!result.confirm) return;
    try {
      await login();
      await request('/me/profile', 'DELETE');
      await Taro.showToast({ title: '保存资料已删除' });
    } catch (e) {
      await Taro.showToast({ title: message(e), icon: 'none' });
    }
  }
  return (
    <View className="page">
      <Text className="title">我的</Text>
      <View className="hero">
        <Text className="subtitle">认识一下，让下一次见面更轻松。</Text>
        <Button
          className="button"
          onClick={() =>
            Taro.navigateTo({ url: '/pages/profile/edit?mode=saved' })
          }
        >
          我的「关于我」
        </Button>
        <Button
          onClick={() => Taro.switchTab({ url: '/pages/activity/index' })}
        >
          我的活动
        </Button>
      </View>
      <Button onClick={() => Taro.navigateTo({ url: '/pages/binding/index' })}>
        关联我的 App
      </Button>
      <Button
        onClick={() => Taro.navigateTo({ url: '/pages/activity/results' })}
      >
        我的整理结果（只有我可见）
      </Button>
      <Button
        onClick={() => {
          void Taro.showModal({
            title: '删除我的云端资料？',
            content:
              '删除私人文字心得、同步 AI、参与资料和关联。本人发起活动将归档并撤回回顾；手机本地照片和录音保留，需另行删除。此操作不可恢复。',
          })
            .then(async (r) => {
              if (r.confirm) {
                await login();
                await request('/me/data', 'DELETE');
                await Taro.showToast({ title: '云端资料已删除' });
              }
            })
            .catch((e) => Taro.showToast({ title: message(e), icon: 'none' }));
        }}
      >
        删除我的云端资料
      </Button>
      <AppGuide />
      <Button onClick={() => void remove()}>删除保存的资料</Button>
      <Text className="hint">
        保存资料用于下次参加时复用，不代表加入公开社交网络。
      </Text>
    </View>
  );
}
