import { router, usePathname } from 'expo-router';
import type { PropsWithChildren } from 'react';
import {
  ScrollView,
  View,
  Text,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  useWindowDimensions,
  type TextInputProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@qinggairugu/design-tokens';
export function Page({
  children,
  bottomInset,
}: PropsWithChildren<{ bottomInset?: boolean }>) {
  const path = usePathname();
  const { width } = useWindowDimensions();
  const back = !['/', '/records', '/people', '/me', '/recording'].includes(
    path,
  );
  const includeBottomInset = bottomInset ?? path === '/privacy';
  return (
    <SafeAreaView
      style={styles.safe}
      edges={includeBottomInset ? ['top', 'bottom'] : ['top']}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[
            styles.page,
            { paddingHorizontal: width >= 720 ? 28 : 20 },
          ]}
          keyboardDismissMode="on-drag"
        >
          {back && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="返回上一页"
              hitSlop={8}
              onPress={() =>
                router.canGoBack() ? router.back() : router.replace('/')
              }
              style={({ pressed }) => [
                styles.backButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.backText}>‹</Text>
              <Text style={styles.backLabel}>返回</Text>
            </Pressable>
          )}
          <View style={[styles.content, width >= 720 && styles.contentWide]}>
            {children}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
export function Heading({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <View style={{ gap: 6, marginBottom: 4 }}>
      <Text accessibilityRole="header" style={styles.title}>
        {title}
      </Text>
      {subtitle && <Text style={styles.body}>{subtitle}</Text>}
    </View>
  );
}
export function Card({
  children,
  style,
}: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  return <View style={[styles.card, style]}>{children}</View>;
}
export function Action({
  label,
  onPress,
  secondary = false,
  disabled = false,
  destructive = false,
  accessibilityHint,
}: {
  label: string;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
  destructive?: boolean;
  accessibilityHint?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: destructive
            ? '#FFF3F0'
            : secondary
              ? colors.surface
              : colors.primary,
          borderColor: destructive
            ? '#EBC9C3'
            : secondary
              ? colors.border
              : colors.primary,
          borderWidth: secondary || destructive ? 1 : 0,
          justifyContent: secondary ? 'space-between' : 'center',
          opacity: disabled ? 0.48 : pressed ? 0.82 : 1,
        },
      ]}
    >
      <Text
        style={{
          color: destructive
            ? colors.danger
            : secondary
              ? colors.primary
              : 'white',
          fontSize: 16,
          flexShrink: 1,
          fontWeight: '600',
        }}
      >
        {label}
      </Text>
      {secondary && (
        <Text style={{ color: colors.muted, fontSize: 22 }}>›</Text>
      )}
    </Pressable>
  );
}

export function AIContentLabel({ label = 'AI生成内容' }: { label?: string }) {
  return (
    <View accessible accessibilityLabel={label} style={styles.aiContentLabel}>
      <Text style={styles.aiContentLabelText}>{label}</Text>
    </View>
  );
}

export function Field({
  label,
  hint,
  containerStyle,
  multiline,
  accessibilityLabel,
  style,
  ...props
}: TextInputProps & {
  label?: string;
  hint?: string;
  containerStyle?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.fieldGroup, containerStyle]}>
      {label ? <Text style={styles.fieldLabel}>{label}</Text> : null}
      <TextInput
        {...props}
        accessibilityLabel={accessibilityLabel ?? label}
        multiline={multiline}
        placeholderTextColor={colors.muted}
        selectionColor={colors.primary}
        textAlignVertical={multiline ? 'top' : props.textAlignVertical}
        style={[styles.input, multiline && styles.multilineInput, style]}
      />
      {hint ? <Text style={styles.caption}>{hint}</Text> : null}
    </View>
  );
}

export const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  page: { flexGrow: 1, paddingTop: 12, paddingBottom: 30 },
  content: { width: '100%', gap: 14 },
  contentWide: { maxWidth: 640, alignSelf: 'center' },
  backButton: {
    alignSelf: 'flex-start',
    minWidth: 72,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginBottom: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  backText: { color: colors.primary, fontSize: 26, lineHeight: 28 },
  backLabel: { color: colors.primary, fontSize: 15, fontWeight: '600' },
  pressed: { opacity: 0.72 },
  title: {
    fontSize: 30,
    fontWeight: '700',
    color: colors.ink,
    letterSpacing: 0,
  },
  body: { fontSize: 16, lineHeight: 25, color: colors.ink },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 18,
    gap: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  button: {
    minHeight: 52,
    borderRadius: 15,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  label: { fontSize: 17, lineHeight: 24, fontWeight: '600', color: colors.ink },
  caption: { fontSize: 14, lineHeight: 21, color: colors.muted },
  fieldGroup: { gap: 7 },
  fieldLabel: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    color: colors.ink,
  },
  input: {
    minHeight: 50,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    color: colors.ink,
    fontSize: 16,
    lineHeight: 23,
  },
  multilineInput: { minHeight: 120, paddingTop: 14 },
  homeHero: {
    gap: 20,
    padding: 20,
    borderRadius: 24,
    backgroundColor: colors.soft,
    borderWidth: 1,
    borderColor: '#DDE5D7',
  },
  homeHeroCopy: { gap: 8 },
  homeEyebrow: {
    color: colors.primary,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  homeHeroTitle: {
    color: colors.ink,
    fontSize: 25,
    lineHeight: 33,
    fontWeight: '700',
  },
  homeHeroBody: { color: colors.muted, fontSize: 15, lineHeight: 23 },
  homeQuickActions: { flexDirection: 'row', gap: 10 },
  quickAction: {
    flex: 1,
    minHeight: 86,
    justifyContent: 'center',
    gap: 5,
    padding: 13,
    borderRadius: 17,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  quickActionTitle: {
    color: colors.ink,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  quickActionDetail: { color: colors.muted, fontSize: 12, lineHeight: 17 },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  sectionHeadingCopy: { flex: 1 },
  textLink: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  recentCard: {
    minHeight: 82,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    padding: 15,
    borderRadius: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  recentMark: {
    width: 4,
    height: 42,
    borderRadius: 3,
    backgroundColor: colors.accent,
  },
  recentCopy: { flex: 1, gap: 5 },
  recentTitle: {
    color: colors.ink,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '600',
  },
  recentChevron: { color: colors.muted, fontSize: 24 },
  exampleCard: { marginTop: 2 },
  inlineActions: { gap: 10 },
  recordChoices: { gap: 8 },
  peopleSummary: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    borderRadius: 18,
    backgroundColor: colors.soft,
  },
  peopleSummaryNumber: {
    color: colors.primary,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  personRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  personAvatar: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 21,
    backgroundColor: colors.soft,
  },
  personAvatarText: { color: colors.primary, fontSize: 17, fontWeight: '700' },
  personCopy: { flex: 1, gap: 3 },
  personName: {
    color: colors.ink,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '600',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 4,
  },
  switchCopy: { flex: 1, gap: 4 },
  error: { color: colors.danger, fontSize: 15, lineHeight: 22 },
  statusText: { color: colors.primary, fontSize: 14, lineHeight: 21 },
  privacyNote: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 22,
    paddingHorizontal: 2,
  },
  aiContentLabel: {
    alignSelf: 'flex-start',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: colors.soft,
    borderWidth: 1,
    borderColor: '#C9D7C5',
  },
  aiContentLabelText: {
    color: colors.primary,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
  },
  exampleTabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  exampleTab: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 13,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  exampleTabSelected: {
    backgroundColor: colors.soft,
    borderColor: '#C9D7C5',
  },
  exampleTabText: { color: colors.muted, fontSize: 14, fontWeight: '600' },
  exampleTabTextSelected: { color: colors.primary },
});
