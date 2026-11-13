import * as SecureStore from 'expo-secure-store';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius } from '@qinggairugu/design-tokens';

export const PRIVACY_POLICY_URL = 'https://qgrg.bebackpacker.com/privacy';
const CONSENT_KEY = 'qinggairugu.privacyConsentVersion';
const CONSENT_VERSION = '2026-11-13';

type ConsentStatus = 'checking' | 'required' | 'saving' | 'accepted' | 'error';
interface PrivacyConsentContextValue {
  status: ConsentStatus;
  error: string;
  accept: () => Promise<void>;
  retry: () => Promise<void>;
}

const PrivacyConsentContext = createContext<PrivacyConsentContextValue | null>(
  null,
);

export function PrivacyConsentProvider({ children }: PropsWithChildren) {
  const [status, setStatus] = useState<ConsentStatus>('checking');
  const [error, setError] = useState('');

  const retry = useCallback(async () => {
    setStatus('checking');
    setError('');
    try {
      const savedVersion = await SecureStore.getItemAsync(CONSENT_KEY);
      setStatus(savedVersion === CONSENT_VERSION ? 'accepted' : 'required');
    } catch {
      setStatus('error');
      setError('无法读取隐私政策选择，请重试后再使用应用。');
    }
  }, []);

  useEffect(() => {
    void retry();
  }, [retry]);

  const accept = useCallback(async () => {
    if (status !== 'required') return;
    setStatus('saving');
    setError('');
    try {
      await SecureStore.setItemAsync(CONSENT_KEY, CONSENT_VERSION);
      setStatus('accepted');
    } catch {
      setStatus('error');
      setError('无法保存你的选择，请重试。应用会在保存成功后继续。');
    }
  }, [status]);

  const value = useMemo(
    () => ({ status, error, accept, retry }),
    [status, error, accept, retry],
  );
  return (
    <PrivacyConsentContext.Provider value={value}>
      {children}
    </PrivacyConsentContext.Provider>
  );
}

export function usePrivacyConsent() {
  const value = useContext(PrivacyConsentContext);
  if (!value) throw new Error('隐私政策状态尚未初始化');
  return value;
}

export function PrivacyConsentScreen() {
  const { status, error, accept, retry } = usePrivacyConsent();
  const busy = status === 'checking' || status === 'saving';

  async function openPolicy() {
    try {
      await Linking.openURL(PRIVACY_POLICY_URL);
    } catch {
      // 外链不可用时仍保留选择页面，不绕过隐私提示。
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.page}
        alwaysBounceVertical={false}
      >
        <View style={styles.brandMark}>
          <Text style={styles.brandMarkText}>倾</Text>
        </View>
        <Text accessibilityRole="header" style={styles.title}>
          开始使用前，请先阅读隐私政策
        </Text>
        <Text style={styles.intro}>
          倾盖如故用于记录线下见面。请了解信息的本机保存、AI处理和云端共享方式，再决定是否继续。
        </Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>录音和照片保存在本机</Text>
          <Text style={styles.cardBody}>
            录音、照片和完整私人记录保存在当前设备，不会自动上传到倾盖如故服务器。
          </Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>AI处理由你主动发起</Text>
          <Text style={styles.cardBody}>
            使用AI整理时，录音会从手机发送到你配置的阿里云百炼临时处理；使用AI搜索时，问题和相关原文片段也会发送给百炼。
          </Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>云端共享由你确认</Text>
          <Text style={styles.cardBody}>
            登录、同步文字或发布本场回顾时，应用会按你确认的范围处理相应信息。原始录音和照片不会随之上传。
          </Text>
        </View>

        <Pressable
          accessibilityRole="link"
          onPress={() => void openPolicy()}
          style={({ pressed }) => [
            styles.policyLink,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.policyLinkText}>阅读完整《隐私政策》</Text>
          <Text style={styles.policyLinkArrow}>↗</Text>
        </Pressable>

        {status === 'checking' && (
          <View style={styles.statusRow}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.statusText}>正在读取你的隐私政策选择…</Text>
          </View>
        )}
        {status === 'saving' && (
          <View style={styles.statusRow}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.statusText}>正在保存…</Text>
          </View>
        )}
        {!!error && (
          <Text accessibilityRole="alert" style={styles.error}>
            {error}
          </Text>
        )}

        {status === 'error' ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => void retry()}
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.primaryButtonText}>重试</Text>
          </Pressable>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: busy || status !== 'required' }}
            disabled={busy || status !== 'required'}
            onPress={() => void accept()}
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && styles.pressed,
              (busy || status !== 'required') && styles.disabledButton,
            ]}
          >
            <Text style={styles.primaryButtonText}>
              我已阅读并同意隐私政策，继续使用
            </Text>
          </Pressable>
        )}

        <Pressable
          accessibilityRole="button"
          onPress={() => BackHandler.exitApp()}
          style={({ pressed }) => [
            styles.exitButton,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.exitButtonText}>暂不同意并退出</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  page: {
    flexGrow: 1,
    justifyContent: 'center',
    gap: 14,
    paddingHorizontal: 22,
    paddingVertical: 28,
  },
  brandMark: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
    backgroundColor: colors.primary,
  },
  brandMarkText: { color: 'white', fontSize: 22, fontWeight: '700' },
  title: {
    color: colors.ink,
    fontSize: 23,
    lineHeight: 31,
    fontWeight: '700',
  },
  intro: { color: colors.muted, fontSize: 15, lineHeight: 23 },
  card: {
    gap: 5,
    padding: 14,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTitle: { color: colors.ink, fontSize: 14, fontWeight: '700' },
  cardBody: { color: colors.muted, fontSize: 13, lineHeight: 20 },
  policyLink: {
    minHeight: 46,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    backgroundColor: colors.soft,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  policyLinkText: { color: colors.primary, fontSize: 15, fontWeight: '700' },
  policyLinkArrow: { color: colors.primary, fontSize: 19 },
  primaryButton: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
  },
  primaryButtonText: {
    color: 'white',
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '700',
    textAlign: 'center',
  },
  disabledButton: { opacity: 0.56 },
  exitButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
  },
  exitButtonText: { color: colors.muted, fontSize: 14, fontWeight: '600' },
  pressed: { opacity: 0.76 },
  statusRow: {
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  statusText: { color: colors.muted, fontSize: 13 },
  error: { color: colors.danger, fontSize: 13, lineHeight: 20 },
});
