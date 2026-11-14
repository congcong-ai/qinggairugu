import { subscribeAccount, accountGeneration } from '../src/account-store';
import { useEffect, useSyncExternalStore } from 'react';
import { initializeDeviceIdentity } from '../src/cloud';
import { RecordingProvider } from '../src/recording-context';
import { router, Stack, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { colors } from '@qinggairugu/design-tokens';
import { View } from 'react-native';
import { AppTabBar, RecordingNotice } from '../src/app-navigation';
import { useRecording } from '../src/recording-context';
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

  return (
    <>
      <StatusBar style="dark" />
      {status === 'accepted' ? (
        <RecordingProvider key={epoch}>
          <AppShell />
        </RecordingProvider>
      ) : (
        <AppRoutes appEnabled={false} />
      )}
    </>
  );
}

function AppShell() {
  const pathname = usePathname();
  const recording = useRecording();
  const isRecordingScreen = pathname === '/recording';
  const showTabs =
    pathname !== '/privacy' &&
    !(
      isRecordingScreen &&
      (recording.status === 'recording' || recording.busy)
    );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <AppRoutes appEnabled />
      {recording.active && !isRecordingScreen && (
        <RecordingNotice
          status={recording.status}
          duration={recording.duration}
          onPress={() => router.replace('/recording')}
        />
      )}
      {showTabs && <AppTabBar pathname={pathname} />}
    </View>
  );
}

function AppRoutes({ appEnabled }: { appEnabled: boolean }) {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Protected guard={appEnabled}>
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
}
