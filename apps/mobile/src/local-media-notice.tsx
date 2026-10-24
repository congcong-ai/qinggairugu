import { Text } from 'react-native';
import { Card, styles } from './ui';
export function LocalMediaNotice() {
  return (
    <Card>
      <Text style={styles.body}>照片和录音，留在这台手机</Text>
      <Text style={styles.caption}>
        录音、拍照和导入照片的本地保存无需联网，不会上传到倾盖如故云端；小程序和其他设备看不到。卸载
        App 或清除应用数据后，本机记录将丢失。
      </Text>
      <Text style={styles.caption}>
        照片会保存为独立的本机副本，删除相册原图不会影响已保存的照片。AI
        整理需要联网，主动发起后录音会直接发送到你配置的百炼服务临时处理。
      </Text>
    </Card>
  );
}
