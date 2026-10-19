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
        <Button onClick={() => Taro.navigateTo({ url: '/pages/me/sessions' })}>
          我参加过的
        </Button>
      </View>
      <Button onClick={() => void remove()}>删除保存的资料</Button>
      <Text className="hint">
        保存资料用于下次参加时复用，不代表加入公开社交网络。
      </Text>
    </View>
  );
}
