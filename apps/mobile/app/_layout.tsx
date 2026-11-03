import { subscribeAccount, accountGeneration } from '../src/account-store';
import { useEffect, useSyncExternalStore } from 'react';
import { initializeDeviceIdentity } from '../src/cloud';
import { RecordingProvider } from '../src/recording-context';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { colors } from '@qinggairugu/design-tokens';
export default function RootLayout() {
  const epoch = useSyncExternalStore(
    subscribeAccount,
    accountGeneration,
    accountGeneration,
  );
  useEffect(() => {
    // 本地生成匿名身份；失败后在使用共享能力时重试，不阻断本地录音。
    void initializeDeviceIdentity().catch(() => {});
  }, []);
  return (
    <RecordingProvider key={epoch}>
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
