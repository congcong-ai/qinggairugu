// 本机独立 Release APK 构建；签名资料只从仓库外的私有配置读取。
import { spawnSync, execFileSync } from 'node:child_process';
import { readFileSync, mkdirSync, copyFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';
import { createHash } from 'node:crypto';
import { format } from 'prettier';
import {
  resolveAndroidBuild,
  androidSourceHash,
  androidArchitectures,
  releaseManifestPath,
} from './lib/android-release.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const mobile = resolve(root, 'apps/mobile');
const signingFile =
  process.env.ANDROID_SIGNING_ENV ||
  resolve(homedir(), '.config/qinggai/signing/release.env');
const signing = parseEnv(readFileSync(signingFile, 'utf8'));
for (const key of [
  'PENGTOU_KEYSTORE_FILE',
  'PENGTOU_KEYSTORE_PASSWORD',
  'PENGTOU_KEY_ALIAS',
  'PENGTOU_KEY_PASSWORD',
]) {
  if (!signing[key]) throw new Error(`签名配置缺少 ${key}`);
}
const sdk =
  process.env.ANDROID_HOME || '/opt/homebrew/share/android-commandlinetools';
const java =
  process.env.JAVA_HOME ||
  execFileSync('/usr/libexec/java_home', ['-v', '21'], {
    encoding: 'utf8',
  }).trim();
const { config, env, expoCli, api } = resolveAndroidBuild(root, {
  ...process.env,
  ...signing,
  ANDROID_HOME: sdk,
  JAVA_HOME: java,
});
const sourceHash = androidSourceHash(root, config, api);
function run(command, args, cwd = mobile) {
  const result = spawnSync(command, args, { cwd, env, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} 执行失败`);
}
// android/ 是被忽略的 Expo 生成目录；重建以移除仓库改名后的绝对路径缓存。
run(process.execPath, [
  expoCli,
  'prebuild',
  '--platform',
  'android',
  '--clean',
  '--no-install',
]);
const gradleArgs = [
  ':app:assembleRelease',
  `-PreactNativeArchitectures=${androidArchitectures.join(',')}`,
  '--console',
  'plain',
];
if (process.env.ANDROID_GRADLE_PROXY) {
  const proxy = new URL(process.env.ANDROID_GRADLE_PROXY);
  for (const protocol of ['http', 'https'])
    gradleArgs.push(
      `-D${protocol}.proxyHost=${proxy.hostname}`,
      `-D${protocol}.proxyPort=${proxy.port || '7890'}`,
    );
}
run('./gradlew', gradleArgs, resolve(mobile, 'android'));
const buildTools = resolve(
  sdk,
  'build-tools',
  process.env.ANDROID_BUILD_TOOLS || '37.0.0',
);
const apk = resolve(
  mobile,
  'android/app/build/outputs/apk/release/app-release.apk',
);
run(resolve(buildTools, 'apksigner'), [
  'verify',
  '--verbose',
  '--print-certs',
  apk,
]);
run(resolve(buildTools, 'zipalign'), ['-c', '-P', '16', '4', apk]);
const badging = execFileSync(
  resolve(buildTools, 'aapt'),
  ['dump', 'badging', apk],
  {
    env,
    encoding: 'utf8',
  },
);
if (
  !badging.includes("application-label:'倾盖如故'") ||
  badging.includes('application-debuggable') ||
  !badging.includes(`name='${config.android.package}'`) ||
  !badging.includes(`versionName='${config.version}'`) ||
  !badging.includes(`versionCode='${config.android.versionCode}'`)
)
  throw new Error('APK 展示名称、版本、包名或 Release 配置不正确');
if (androidSourceHash(root, config, api) !== sourceHash)
  throw new Error('构建过程中 App 源码发生变化，请重新执行 pnpm android:build');
const output = resolve(root, 'artifacts/android');
mkdirSync(output, { recursive: true });
const filename = `qinggai-${config.version}-release.apk`;
copyFileSync(apk, resolve(output, filename));
const bytes = readFileSync(apk);
const sha256 = createHash('sha256').update(bytes).digest('hex');
writeFileSync(
  resolve(output, `${filename}.sha256`),
  `${sha256}  ${filename}\n`,
);
const manifest = await format(
  JSON.stringify({
    schemaVersion: 1,
    name: config.name,
    version: config.version,
    versionCode: config.android.versionCode,
    package: config.android.package,
    api,
    architectures: androidArchitectures,
    filename,
    bytes: bytes.length,
    sha256,
    sourceHash,
    builtAt: new Date().toISOString(),
  }),
  { parser: 'json' },
);
writeFileSync(resolve(output, 'release.json'), manifest);
writeFileSync(resolve(root, releaseManifestPath), manifest);
console.log(`独立 Release APK 已生成：${resolve(output, filename)}`);
console.log('构建与签名校验不代表线上 API 和小程序体验版已经就绪。');
