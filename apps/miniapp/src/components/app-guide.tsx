import { View, Text, Button } from '@tarojs/components';
import Taro from '@tarojs/taro';
export function AppGuide() {
  return (
    <View className="card">
      <Text className="subtitle">想录音、添加照片？用 App 记录</Text>
      <Text className="hint">
        小程序只记录文字，不提供录音、选图或图片上传。请下载 Android
        App；照片和录音只保存在使用 App 的那台手机，小程序和其他设备看不到。
      </Text>
      <Button
        className="row-button"
        onClick={() => {
          void Taro.setClipboardData({ data: 'https://qgrg.bebackpacker.com' })
            .then(() =>
              Taro.showModal({
                title: '前往官网下载 App',
                content:
                  '官网地址已复制，请在手机浏览器中粘贴打开，选择 Android 下载。新功能以已发布版本为准。',
                showCancel: false,
              }),
            )
            .catch(() =>
              Taro.showToast({ title: '复制失败，请重试', icon: 'none' }),
            );
        }}
      >
        复制 App 下载官网地址
      </Button>
    </View>
  );
}
