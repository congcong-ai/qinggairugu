import { defineConfig } from '@tarojs/cli';
export default defineConfig({
  projectName: 'pengtou',
  defineConstants: {
    API_BASE: JSON.stringify(
      process.env.TARO_APP_API_URL || 'http://127.0.0.1:9001',
    ),
    DEV_AUTH: JSON.stringify(
      process.env.NODE_ENV !== 'production' &&
        process.env.TARO_APP_DEV_AUTH === 'true',
    ),
  },
  date: '2026-10-17',
  designWidth: 750,
  deviceRatio: { 750: 1 },
  sourceRoot: 'src',
  outputRoot: 'dist',
  framework: 'react',
  compiler: 'vite',
  plugins: ['@tarojs/plugin-platform-weapp'],
  mini: {},
  h5: {},
});
