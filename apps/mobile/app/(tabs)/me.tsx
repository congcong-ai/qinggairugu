import { router } from 'expo-router';
import Constants from 'expo-constants';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius } from '@qinggairugu/design-tokens';
import { Heading, Page } from '../../src/ui';
import { PRIVACY_POLICY_URL } from '../../src/privacy-consent';

const version = Constants.expoConfig?.version ?? '未知';

function SettingRow({
  icon,
  title,
  detail,
  onPress,
  last = false,
}: {
  icon: string;
  title: string;
  detail: string;
  onPress: () => void;
  last?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        !last && styles.rowBorder,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.icon}>
        <Text style={styles.iconText}>{icon}</Text>
      </View>
      <View style={styles.rowCopy}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowDetail}>{detail}</Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

export default function Screen() {
  return (
    <Page>
      <Heading title="我的" subtitle="你的记录，由你掌握。" />

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>账号与连接</Text>
        <View style={styles.group}>
          <SettingRow
            icon="◉"
            title="账号与登录"
            detail="微信登录、本机记录归属与退出"
            onPress={() => router.push('/account')}
          />
          <SettingRow
            icon="↗"
            title="关联我的小程序"
            detail="连接本人小程序，管理个人内容"
            onPress={() => router.push('/binding')}
            last
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>偏好与体验</Text>
        <View style={styles.group}>
          <SettingRow
            icon="✳"
            title="AI 服务"
            detail="配置用于整理和搜索的百炼 Key"
            onPress={() => router.push('/ai-settings')}
          />
          <SettingRow
            icon="◇"
            title="先看看示例"
            detail="浏览一份示例记录，无需登录"
            onPress={() => router.push('/example')}
            last
          />
        </View>
      </View>

      <View style={styles.privacyCard}>
        <View style={styles.privacyHeading}>
          <Text style={styles.privacyIcon}>⌂</Text>
          <Text style={styles.privacyTitle}>隐私与本机数据</Text>
        </View>
        <Text style={styles.privacyCopy}>
          录音和照片保存在这台设备。你主动整理时，录音会临时发送到自己配置的 AI
          服务处理。
        </Text>
        <Pressable
          accessibilityRole="link"
          onPress={() =>
            void Linking.openURL(PRIVACY_POLICY_URL).catch(() => {})
          }
          style={({ pressed }) => pressed && styles.pressed}
        >
          <Text style={styles.privacyLink}>阅读完整隐私政策 ↗</Text>
        </Pressable>
      </View>

      <View style={styles.footer}>
        <Text style={styles.brand}>倾盖如故</Text>
        <Text style={styles.tagline}>把每一次见面留下来</Text>
        <View style={styles.versionPill}>
          <Text style={styles.version}>当前版本 {version}</Text>
        </View>
      </View>
    </Page>
  );
}

const styles = StyleSheet.create({
  section: { gap: 9 },
  sectionTitle: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '600',
    paddingHorizontal: 4,
  },
  group: {
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  row: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  pressed: { backgroundColor: colors.soft },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.soft,
  },
  iconText: { color: colors.primary, fontSize: 18, fontWeight: '600' },
  rowCopy: { flex: 1, gap: 3 },
  rowTitle: { color: colors.ink, fontSize: 15, fontWeight: '600' },
  rowDetail: { color: colors.muted, fontSize: 12, lineHeight: 17 },
  chevron: { color: colors.muted, fontSize: 24, marginLeft: 2 },
  privacyCard: {
    marginTop: 2,
    gap: 8,
    padding: 15,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  privacyHeading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  privacyIcon: { color: colors.primary, fontSize: 18 },
  privacyTitle: { color: colors.ink, fontSize: 14, fontWeight: '600' },
  privacyCopy: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  privacyLink: { color: colors.primary, fontSize: 13, fontWeight: '600' },
  footer: { alignItems: 'center', paddingTop: 3, paddingBottom: 12, gap: 5 },
  brand: { color: colors.ink, fontSize: 15, fontWeight: '600' },
  tagline: { color: colors.muted, fontSize: 12 },
  versionPill: {
    marginTop: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.soft,
  },
  version: { color: colors.muted, fontSize: 12, fontVariant: ['tabular-nums'] },
});
