import type { ExpoConfig } from 'expo/config';
const config: ExpoConfig = {
  name: '倾盖如故',
  slug: 'qinggai',
  version: '0.2.6',
  icon: './assets/icon.png',
  scheme: 'qinggairugu',
  orientation: 'portrait',
  userInterfaceStyle: 'light',
  ios: {
    appleTeamId: 'G6692S3U7C',
    bundleIdentifier: 'com.bebackpacker.qinggairugu',
    buildNumber: '2',
    supportsTablet: false,
    infoPlist: {
      CFBundleLocalizations: ['zh_CN'],
    },
  },
  android: {
    package: process.env.ANDROID_PACKAGE || 'com.bebackpacker.qinggairugu',
    versionCode: 10,
    adaptiveIcon: {
      foregroundImage: './assets/icon-foreground.png',
      backgroundColor: '#F7F4EE',
    },
    allowBackup: false,
    permissions: ['android.permission.CAMERA'],
    blockedPermissions: [
      'android.permission.READ_MEDIA_IMAGES',
      'android.permission.READ_MEDIA_VIDEO',
      'android.permission.READ_EXTERNAL_STORAGE',
      'android.permission.WRITE_EXTERNAL_STORAGE',
      'android.permission.USE_BIOMETRIC',
      'android.permission.USE_FINGERPRINT',
      'android.permission.SYSTEM_ALERT_WINDOW',
    ],
  },
  plugins: [
    'expo-router',
    ['./plugins/with-wechat.cjs', { appId: 'wx2f97ade32e73a58b' }],
    'expo-dev-client',
    // SDK 自带 vec.so 只有 4 KB ELF 对齐，使用既有 JS 相似度检索保留历史向量。
    ['expo-sqlite', { withSQLiteVecExtension: false }],
    './plugins/with-android-release.cjs',
    [
      'expo-splash-screen',
      {
        backgroundColor: '#F7F4EE',
        image: './assets/icon.png',
        imageWidth: 160,
      },
    ],
    ['expo-secure-store', { configureAndroidBackup: false }],
    [
      'expo-image-picker',
      {
        cameraPermission: '拍照并将照片副本保存在当前手机，不上传云端。',
        photosPermission: '选择照片并将独立副本保存在当前手机。',
      },
    ],
    [
      'expo-audio',
      {
        enableBackgroundRecording: true,
        enableBackgroundPlayback: false,
        microphonePermission: '倾盖如故需要麦克风权限来记录这次见面。',
      },
    ],
    './plugins/with-local-only-backup.cjs',
    './plugins/with-ios-scene-delegate.cjs',
  ],
  experiments: { typedRoutes: true },
};
export default config;
