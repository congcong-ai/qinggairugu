import { subscribeAccount, accountGeneration } from '../src/account-store';
import { useEffect, useSyncExternalStore } from 'react';
import { initializeDeviceIdentity } from '../src/cloud';
import { RecordingProvider } from '../src/recording-context';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { colors } from '@qinggairugu/design-tokens';
import {
  PrivacyConsentProvider,
  usePrivacyConsent,
} from '../src/privacy-consent';

export const unstable_settings = { initialRouteName: 'privacy' };

export default function RootLayout() {
  return (
    <PrivacyConsentProvider>
      <RootNavigation />
    </PrivacyConsentProvider>
  );
}

function RootNavigation() {
  const { status } = usePrivacyConsent();
  const epoch = useSyncExternalStore(
    subscribeAccount,
    accountGeneration,
    accountGeneration,
  );
  useEffect(() => {
    if (status !== 'accepted') return;
    // 用户确认隐私政策后才生成匿名身份；失败后在使用共享能力时重试。
    void initializeDeviceIdentity().catch(() => {});
  }, [status]);

  const stack = (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Protected guard={status === 'accepted'}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="account" />
        <Stack.Screen name="activity-join" />
        <Stack.Screen name="activity-link" />
        <Stack.Screen name="ai-settings" />
        <Stack.Screen name="analysis" />
        <Stack.Screen name="binding" />
        <Stack.Screen name="cloud-results" />
        <Stack.Screen name="create" />
        <Stack.Screen name="entry" />
        <Stack.Screen name="example" />
        <Stack.Screen name="join" />
        <Stack.Screen name="private-sync" />
        <Stack.Screen name="recap" />
        <Stack.Screen name="recording" options={{ gestureEnabled: false }} />
        <Stack.Screen name="search" />
        <Stack.Screen name="session/[id]" />
        <Stack.Screen name="shared-recap" />
        <Stack.Screen name="start" />
      </Stack.Protected>
      <Stack.Screen name="privacy" options={{ gestureEnabled: false }} />
    </Stack>
  );

  return (
    <>
      <StatusBar style="dark" />
      {status === 'accepted' ? (
        <RecordingProvider key={epoch}>{stack}</RecordingProvider>
      ) : (
        stack
      )}
    </>
  );
}
