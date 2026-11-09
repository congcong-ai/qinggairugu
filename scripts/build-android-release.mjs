// 本机独立 Release APK 构建；签名资料只从仓库外的私有配置读取。
import { spawnSync, execFileSync } from 'node:child_process';
import {
  readFileSync,
  mkdirSync,
  copyFileSync,
  writeFileSync,
  readdirSync,
  lstatSync,
  realpathSync,
  rmSync,
  existsSync,
} from 'node:fs';
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
  assert16KBElf,
} from './lib/android-release.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const mobile = resolve(root, 'apps/mobile');
const signingFile =
  process.env.ANDROID_SIGNING_ENV ||
  resolve(homedir(), '.config/qinggai/signing/release.env');
const signing = parseEnv(readFileSync(signingFile, 'utf8'));
for (const key of [
  'QINGGAIRUGU_KEYSTORE_FILE',
  'QINGGAIRUGU_KEYSTORE_PASSWORD',
  'QINGGAIRUGU_KEY_ALIAS',
  'QINGGAIRUGU_KEY_PASSWORD',
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
const nativeFiles = execFileSync(resolve(buildTools, 'aapt'), ['list', apk], {
  env,
  encoding: 'utf8',
})
  .split('\n')
  .filter((name) => /^lib\/[^/]+\/[^/]+\.so$/.test(name));
const actualArchitectures = [
  ...new Set(nativeFiles.map((name) => name.split('/')[1])),
].sort();
if (
  JSON.stringify(actualArchitectures) !==
  JSON.stringify([...androidArchitectures].sort())
)
  throw new Error('APK 实际原生架构与发布配置不一致');
for (const name of nativeFiles.filter((name) =>
  /^lib\/(arm64-v8a|x86_64)\//.test(name),
)) {
  const bytes = execFileSync('unzip', ['-p', apk, name], {
    env,
    maxBuffer: 128 * 1024 * 1024,
  });
  assert16KBElf(bytes, name);
}
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
const bytes = readFileSync(apk);
const sha256 = createHash('sha256').update(bytes).digest('hex');
const mappingSource = resolve(
  mobile,
  'android/app/build/outputs/mapping/release/mapping.txt',
);
const symbolsSource = resolve(
  mobile,
  'android/app/build/outputs/native-debug-symbols/release/native-debug-symbols.zip',
);
if (!existsSync(mappingSource) || !existsSync(symbolsSource))
  throw new Error('缺少 Android 混淆映射或原生调试符号，保留构建目录供排查');
const mappingFilename = `${filename}.mapping.txt`;
const symbolsFilename = `${filename}.native-debug-symbols.zip`;
const mappingBytes = readFileSync(mappingSource);
const symbolsBytes = readFileSync(symbolsSource);
if (mappingBytes.length === 0 || symbolsBytes.length === 0)
  throw new Error('Android 调试符号文件为空，保留构建目录供排查');
copyFileSync(apk, resolve(output, filename));
writeFileSync(
  resolve(output, `${filename}.sha256`),
  `${sha256}  ${filename}\n`,
);
copyFileSync(mappingSource, resolve(output, mappingFilename));
copyFileSync(symbolsSource, resolve(output, symbolsFilename));
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
    mappingFilename,
    mappingSha256: createHash('sha256').update(mappingBytes).digest('hex'),
    nativeSymbolsFilename: symbolsFilename,
    nativeSymbolsSha256: createHash('sha256')
      .update(symbolsBytes)
      .digest('hex'),
    builtAt: new Date().toISOString(),
  }),
  { parser: 'json' },
);
writeFileSync(resolve(output, 'release.json'), manifest);
writeFileSync(resolve(root, releaseManifestPath), manifest);
// 只保留最新已验证 APK 套件；AAB 是不同交付类型，保持独立。
for (const oldApk of readdirSync(output).filter(
  (name) =>
    /^qinggai-\d+\.\d+\.\d+-release\.apk$/.test(name) && name !== filename,
))
  for (const suffix of [
    '',
    '.sha256',
    '.idsig',
    '.mapping.txt',
    '.native-debug-symbols.zip',
  ])
    rmSync(resolve(output, oldApk + suffix), { force: true });

// 新安装包、校验和、manifest、映射及符号已经复制并验过后，清除本项目可重建的 Android 中间产物。
const mobileRoot = realpathSync(mobile);
const generated = [
  resolve(mobileRoot, 'android/build'),
  resolve(mobileRoot, 'android/app/build'),
  resolve(mobileRoot, 'android/app/.cxx'),
];
const pnpmStore = resolve(root, 'node_modules/.pnpm');
if (existsSync(pnpmStore))
  for (const packageEntry of readdirSync(pnpmStore, { withFileTypes: true })) {
    if (!packageEntry.isDirectory()) continue;
    const packageLinks = resolve(pnpmStore, packageEntry.name, 'node_modules');
    if (!existsSync(packageLinks)) continue;
    for (const dependency of readdirSync(packageLinks, {
      withFileTypes: true,
    })) {
      if (!dependency.isSymbolicLink()) continue;
      const dependencyRoot = realpathSync(
        resolve(packageLinks, dependency.name),
      );
      if (!dependencyRoot.startsWith(pnpmStore + '/')) continue;
      generated.push(
        resolve(dependencyRoot, 'android/build'),
        resolve(dependencyRoot, 'android/.cxx'),
      );
    }
  }
for (const path of [...new Set(generated)]) {
  if (!existsSync(path) || lstatSync(path).isSymbolicLink()) continue;
  const canonical = realpathSync(path);
  if (
    canonical.startsWith(mobileRoot + '/android/') ||
    canonical.startsWith(pnpmStore + '/')
  )
    rmSync(canonical, { recursive: true, force: true });
}
console.log(`独立 Release APK 已生成：${resolve(output, filename)}`);
console.log('构建与签名校验不代表线上 API 和小程序体验版已经就绪。');
