import { View, Text, Button } from '@tarojs/components';
import Taro from '@tarojs/taro';
export default function Me() {
  const rows = [
    ['我的整理结果', '仅自己可见', '/pages/activity/results'],
    ['关联我的 App', '', '/pages/binding/index'],
    ['隐私与数据', '', '/pages/me/privacy'],
    ['关于倾盖如故', '下载 App', '/pages/me/about'],
  ];
  return (
    <View className="page me-page">
      <Text className="title">我的</Text>
      <Button
        className="row-button profile-entry"
        onClick={() =>
          Taro.navigateTo({ url: '/pages/profile/edit?mode=saved' })
        }
      >
        <View className="profile-avatar">我</View>
        <View className="row-content">
          <Text className="profile-title">我的「关于我」</Text>
          <Text className="hint">让下一次见面更轻松</Text>
        </View>
        <Text className="chevron">›</Text>
      </Button>
      <View className="list-group">
        {rows.map(([title, note, url]) => (
          <Button
            className="row-button settings-row"
            key={url}
            onClick={() => Taro.navigateTo({ url: url! })}
          >
            <Text>{title}</Text>
            <View className="row-trailing">
              <Text className="hint">{note}</Text>
              <Text className="chevron">›</Text>
            </View>
          </Button>
        ))}
      </View>
      <Text className="brand-footer">倾盖如故 · 把每一次见面留下来</Text>
    </View>
  );
}
