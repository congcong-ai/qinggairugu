import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  AndroidReleaseError,
  resolveAndroidBuild,
  readCurrentAndroidRelease,
  checkOnlineAndroidRelease,
} from './lib/android-release.mjs';

try {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const { config, api } = resolveAndroidBuild(root);
  if (api !== 'https://qgrg.bebackpacker.com')
    throw new AndroidReleaseError(
      'China 部署只接受连接正式 API 的 APK，请使用 EXPO_PUBLIC_API_URL=https://qgrg.bebackpacker.com 构建并发布后重试。',
    );
  const release = readCurrentAndroidRelease(root, config, api);
  console.log(
    `正在检查官网 APK：${release.version} / versionCode ${release.versionCode}，并校验实际下载文件……`,
  );
  await checkOnlineAndroidRelease(release);
  console.log(
    `官网 APK 已是当前源码的最新构建，SHA256 校验通过：${release.sha256}`,
  );
} catch (error) {
  console.error(
    `部署已终止：${error instanceof AndroidReleaseError ? error.message : 'APK 检查失败，请确认本地依赖完整、构建清单有效后重试。'}`,
  );
  process.exitCode = 1;
}
