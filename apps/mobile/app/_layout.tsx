import { useEffect } from 'react';
import { initializeDeviceIdentity } from '../src/cloud';
import { RecordingProvider } from '../src/recording-context';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { colors } from '@pengtou/design-tokens';
export default function RootLayout() {
  useEffect(() => {
    // 本地生成匿名身份；失败后在使用共享能力时重试，不阻断本地录音。
    void initializeDeviceIdentity().catch(() => {});
  }, []);
  return (
    <RecordingProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="(tabs)" />
      </Stack>
    </RecordingProvider>
  );
}
