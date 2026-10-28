import { View, Text, Button } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { login, request, message } from '../../lib/api';
export default function Privacy() {
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
      <Text className="title">隐私与数据</Text>
      <View className="card">
        <Text className="row-title">你的信息，由你掌握</Text>
        <Text className="hint">
          保存的「关于我」只用于下次确认复用，不代表加入公开社交网络。心得和同步的
          AI 文字仅本人可见；共享回顾由主办方单独发布。
        </Text>
      </View>
      <View className="list-group">
        <Button
          className="row-button settings-row"
          onClick={() => void remove()}
        >
          <Text>删除保存的关于我</Text>
          <Text className="chevron">›</Text>
        </Button>
        <Button
          className="row-button settings-row danger-row"
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
              .catch((e) =>
                Taro.showToast({ title: message(e), icon: 'none' }),
              );
          }}
        >
          <Text>删除我的云端资料</Text>
          <Text className="chevron">›</Text>
        </Button>
      </View>
      <Text className="hint">
        删除云端资料不可恢复。App 本机录音和照片保留，需要在 App 内单独管理。
      </Text>
    </View>
  );
}
