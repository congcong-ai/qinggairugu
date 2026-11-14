/* eslint-disable @typescript-eslint/no-require-imports -- Metro 本地图片需要静态 require。 */
import { router } from 'expo-router';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@qinggairugu/design-tokens';
import { formatDuration } from '@qinggairugu/shared';

const tabs = [
  {
    key: 'home',
    label: '记录',
    href: '/',
    icon: require('../assets/tabs/home-idle.png'),
  },
  {
    key: 'records',
    label: '我的活动',
    href: '/records',
    icon: require('../assets/tabs/records-idle.png'),
  },
  {
    key: 'people',
    label: '见过的人',
    href: '/people',
    icon: require('../assets/tabs/people-idle.png'),
  },
  {
    key: 'me',
    label: '我的',
    href: '/me',
    icon: require('../assets/tabs/me-idle.png'),
  },
] as const;

type TabKey = (typeof tabs)[number]['key'];

export function AppTabBar({ pathname }: { pathname: string }) {
  const selected = selectedTab(pathname);
  return (
    <SafeAreaView edges={['bottom']} style={styles.tabSafeArea}>
      <View accessibilityRole="tablist" style={styles.tabBar}>
        {tabs.map((tab) => {
          const active = tab.key === selected;
          const color = active ? colors.primary : colors.muted;
          return (
            <Pressable
              key={tab.key}
              accessibilityRole="tab"
              accessibilityLabel={tab.label}
              accessibilityState={{ selected: active }}
              onPress={() => router.replace(tab.href)}
              style={({ pressed }) => [
                styles.tab,
                pressed && styles.tabPressed,
              ]}
            >
              <Image
                source={tab.icon}
                style={[styles.tabIcon, { tintColor: color }]}
              />
              <Text style={[styles.tabLabel, { color }]}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

export function RecordingNotice({
  status,
  duration,
  onPress,
}: {
  status: 'idle' | 'recording' | 'paused' | 'interrupted';
  duration: number;
  onPress: () => void;
}) {
  const label =
    status === 'paused'
      ? '录音已暂停'
      : status === 'interrupted'
        ? '录音已中断'
        : '录音正在进行';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}，${formatDuration(duration)}，打开录音控制`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.recordingNotice,
        pressed && styles.noticePressed,
      ]}
    >
      <View style={styles.recordingDot} />
      <View style={styles.noticeCopy}>
        <Text style={styles.noticeTitle}>{label}</Text>
        <Text style={styles.noticeSubtitle}>{formatDuration(duration)}</Text>
      </View>
      <Text style={styles.noticeAction}>返回录音 ›</Text>
    </Pressable>
  );
}

function selectedTab(pathname: string): TabKey | null {
  if (pathname === '/' || pathname === '/entry' || pathname === '/start')
    return 'home';
  if (pathname === '/people' || pathname.startsWith('/people/'))
    return 'people';
  if (
    pathname === '/me' ||
    pathname === '/account' ||
    pathname === '/ai-settings' ||
    pathname === '/private-sync'
  )
    return 'me';
  if (
    pathname === '/records' ||
    pathname.startsWith('/session/') ||
    [
      '/activity-join',
      '/activity-link',
      '/analysis',
      '/cloud-results',
      '/create',
      '/recap',
      '/shared-recap',
    ].includes(pathname)
  )
    return 'records';
  return null;
}

const styles = StyleSheet.create({
  tabSafeArea: {
    backgroundColor: colors.surface,
  },
  tabBar: {
    minHeight: 66,
    flexDirection: 'row',
    alignItems: 'stretch',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: 6,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  tabPressed: {
    opacity: 0.65,
  },
  tabIcon: {
    width: 24,
    height: 24,
  },
  tabLabel: {
    fontSize: 11,
    lineHeight: 16,
  },
  recordingNotice: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 14,
    backgroundColor: '#EAF2EB',
  },
  noticePressed: {
    opacity: 0.8,
  },
  recordingDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.danger,
  },
  noticeCopy: {
    flex: 1,
    gap: 2,
  },
  noticeTitle: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '600',
  },
  noticeSubtitle: {
    color: colors.muted,
    fontSize: 12,
  },
  noticeAction: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '600',
  },
});
