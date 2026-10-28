import { View, Text } from '@tarojs/components';
import { AppGuide } from '../../components/app-guide';
export default function About() {
  return (
    <View className="page">
      <Text className="title">倾盖如故</Text>
      <Text className="subtitle">把每一次见面留下来。</Text>
      <AppGuide />
      <View className="card">
        <Text className="row-title">照片和录音留在手机</Text>
        <Text className="hint">
          App 的照片和录音支持离线保存，其他设备不可见；卸载或清除 App
          数据后会丢失。照片保存独立副本，删除相册原图不影响已保存的副本。主动
          AI 整理时，录音直接发送给你配置的百炼服务临时处理。
        </Text>
      </View>
    </View>
  );
}
