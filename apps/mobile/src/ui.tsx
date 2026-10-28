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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@pengtou/design-tokens';
export function Page({ children }: PropsWithChildren) {
  const path = usePathname();
  const back = !['/', '/records', '/people', '/me', '/recording'].includes(
    path,
  );
  return (
    <SafeAreaView
      style={styles.safe}
      edges={back || path === '/recording' ? ['top', 'bottom'] : ['top']}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.page}
          keyboardDismissMode="on-drag"
        >
          {back && (
            <Pressable
              accessibilityRole="button"
              onPress={() =>
                router.canGoBack() ? router.back() : router.replace('/')
              }
              style={{ minHeight: 44, justifyContent: 'center' }}
            >
              <Text style={{ color: colors.primary, fontSize: 17 }}>
                ‹ 返回
              </Text>
            </Pressable>
          )}
          {children}
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
      <Text style={styles.title}>{title}</Text>
      {subtitle && <Text style={styles.body}>{subtitle}</Text>}
    </View>
  );
}
export function Card({ children }: PropsWithChildren) {
  return <View style={styles.card}>{children}</View>;
}
export function Action({
  label,
  onPress,
  secondary = false,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: secondary ? colors.surface : colors.primary,
          justifyContent: secondary ? 'space-between' : 'center',
          opacity: disabled ? 0.45 : pressed ? 0.8 : 1,
        },
      ]}
    >
      <Text
        style={{
          color: secondary ? colors.primary : 'white',
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
export const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  page: { padding: 20, paddingTop: 16, gap: 14, paddingBottom: 32 },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.ink,
    letterSpacing: 0,
  },
  body: { fontSize: 16, lineHeight: 24, color: colors.muted },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 18,
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  button: {
    minHeight: 48,
    borderRadius: 12,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  label: { fontSize: 18, fontWeight: '600', color: colors.ink },
  caption: { fontSize: 13, lineHeight: 21, color: colors.muted },
});
