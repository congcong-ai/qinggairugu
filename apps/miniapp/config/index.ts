import { defineConfig } from '@tarojs/cli';
export default defineConfig({
  projectName: 'qinggairugu',
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
