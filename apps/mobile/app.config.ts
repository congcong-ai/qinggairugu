import type { ExpoConfig } from 'expo/config';
const config: ExpoConfig = {
  name: '倾盖如故',
  slug: 'qinggai',
  version: '0.1.1',
  icon: './assets/icon.png',
  scheme: 'pengtou',
  orientation: 'portrait',
  userInterfaceStyle: 'light',
  android: {
    package: process.env.ANDROID_PACKAGE || 'com.xixisys.pengtou',
    versionCode: 2,
    allowBackup: false,
    blockedPermissions: [
      'android.permission.READ_EXTERNAL_STORAGE',
      'android.permission.WRITE_EXTERNAL_STORAGE',
      'android.permission.USE_BIOMETRIC',
      'android.permission.USE_FINGERPRINT',
      'android.permission.SYSTEM_ALERT_WINDOW',
    ],
  },
  plugins: [
    'expo-router',
    'expo-dev-client',
    ['expo-sqlite', { withSQLiteVecExtension: true }],
    './plugins/with-android-release.cjs',
    [
      'expo-splash-screen',
      {
        backgroundColor: '#F7F4EE',
        image: './assets/icon.png',
        imageWidth: 160,
      },
    ],
    'expo-secure-store',
    [
      'expo-audio',
      {
        enableBackgroundRecording: true,
        enableBackgroundPlayback: false,
        microphonePermission: '倾盖如故需要麦克风权限来记录这次见面。',
      },
    ],
  ],
  experiments: { typedRoutes: true },
};
export default config;
