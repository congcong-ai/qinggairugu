import { router, usePathname } from 'expo-router';
import type { PropsWithChildren } from 'react';
import { ScrollView, View, Text, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@pengtou/design-tokens';
export function Page({ children }: PropsWithChildren) {
  const path = usePathname();
  const back =
    !['/', '/records', '/people', '/me', '/recording'].includes(path) &&
    router.canGoBack();
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.page}
      >
        {back && (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.back()}
            style={{ minHeight: 44, justifyContent: 'center' }}
          >
            <Text style={{ color: colors.primary, fontSize: 17 }}>‹ 返回</Text>
          </Pressable>
        )}
        {children}
      </ScrollView>
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
    <View style={{ gap: 10, marginBottom: 24 }}>
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
          backgroundColor: secondary ? colors.soft : colors.primary,
          opacity: disabled ? 0.45 : pressed ? 0.8 : 1,
        },
      ]}
    >
      <Text
        style={{
          color: secondary ? colors.primary : 'white',
          fontSize: 18,
          fontWeight: '600',
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
export const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  page: { padding: 24, paddingTop: 28, gap: 20, paddingBottom: 48 },
  title: {
    fontSize: 34,
    fontWeight: '700',
    color: colors.ink,
    letterSpacing: 1,
  },
  body: { fontSize: 16, lineHeight: 26, color: colors.muted },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: 24,
    gap: 14,
  },
  button: {
    minHeight: 60,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  label: { fontSize: 20, fontWeight: '600', color: colors.ink },
  caption: { fontSize: 13, lineHeight: 21, color: colors.muted },
});
