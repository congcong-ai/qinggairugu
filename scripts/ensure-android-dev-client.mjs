import { createHash } from 'node:crypto';
import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  writeFileSync,
} from 'node:fs';
import { spawnSync } from 'node:child_process';
import { homedir } from 'node:os';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const mobile = resolve(root, 'apps/mobile');
const sdkRoot =
  process.env.ANDROID_SDK_ROOT ||
  process.env.ANDROID_HOME ||
  (process.platform === 'darwin'
    ? resolve(homedir(), 'Library/Android/sdk')
    : process.platform === 'win32'
      ? resolve(process.env.LOCALAPPDATA ?? homedir(), 'Android/Sdk')
      : resolve(homedir(), 'Android/Sdk'));
const adb = resolve(sdkRoot, 'platform-tools/adb');
const emulator = resolve(sdkRoot, 'emulator/emulator');

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  });
}

function emulatorDevices() {
  const result = run(adb, ['devices']);
  if (result.status !== 0) return [];
  return (result.stdout ?? '')
    .split(/\r?\n/)
    .map((line) => line.trim().split(/\s+/))
    .filter(([serial]) => /^emulator-\d+$/.test(serial ?? ''))
    .map(([serial, state]) => ({ serial, state }));
}

function waitForBoot() {
  const avds = existsSync(emulator)
    ? run(emulator, ['-list-avds'])
        .stdout.split(/\r?\n/)
        .map((name) => name.trim())
        .filter(Boolean)
    : [];
  if (
    !existsSync(adb) ||
    (avds.length === 0 && emulatorDevices().length === 0)
  ) {
    console.warn('未发现 Android 模拟器，跳过开发版安装。');
    return null;
  }

  const deadline = Date.now() + 180_000;
  while (Date.now() < deadline) {
    const candidates = emulatorDevices().filter(
      ({ state }) => state === 'device',
    );
    const selected =
      candidates.find(({ serial }) => serial === process.env.ANDROID_SERIAL) ??
      candidates[0];
    if (selected) {
      const boot = run(adb, [
        '-s',
        selected.serial,
        'shell',
        'getprop',
        'sys.boot_completed',
      ]);
      if (boot.status === 0 && boot.stdout.trim() === '1')
        return selected.serial;
    }
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1000);
  }
  console.warn('Android 模拟器未能在 180 秒内完成启动，跳过开发版安装。');
  return null;
}

function getExpoConfig() {
  const result = run('pnpm', [
    '--filter',
    '@qinggairugu/mobile',
    'exec',
    'expo',
    'config',
    '--json',
    '--type',
    'public',
  ]);
  if (result.status !== 0)
    throw new Error(result.stderr || '读取 Expo 配置失败');
  return JSON.parse(result.stdout);
}

function visitFiles(directory, hash) {
  if (!existsSync(directory)) return;
  const ignoredDirectories = new Set([
    '.gradle',
    '.cxx',
    'build',
    'node_modules',
  ]);
  for (const entry of readdirSync(directory, { withFileTypes: true }).sort(
    (a, b) => a.name.localeCompare(b.name),
  )) {
    if (entry.isSymbolicLink()) continue;
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      if (!ignoredDirectories.has(entry.name)) visitFiles(path, hash);
      continue;
    }
    if (!entry.isFile() || entry.name === 'local.properties') continue;
    hash.update(relative(root, path));
    hash.update('\0');
    hash.update(readFileSync(path));
    hash.update('\0');
  }
}

function nativeFingerprint(config, keystorePath) {
  const hash = createHash('sha256');
  hash.update(
    JSON.stringify({
      name: config.name,
      slug: config.slug,
      version: config.version,
      scheme: config.scheme,
      android: config.android,
      plugins: config.plugins,
      experiments: config.experiments,
    }),
  );
  for (const path of [
    resolve(root, 'package.json'),
    resolve(root, 'pnpm-lock.yaml'),
    resolve(root, 'pnpm-workspace.yaml'),
    resolve(mobile, 'package.json'),
    resolve(mobile, 'app.config.ts'),
    resolve(mobile, 'android'),
    resolve(mobile, 'plugins'),
  ]) {
    if (existsSync(path) && lstatSync(path).isDirectory())
      visitFiles(path, hash);
    else if (existsSync(path)) {
      hash.update(relative(root, path));
      hash.update('\0');
      hash.update(readFileSync(path));
      hash.update('\0');
    }
  }
  if (keystorePath && existsSync(keystorePath))
    hash.update(readFileSync(keystorePath));
  return hash.digest('hex');
}

function installedPackage(serial, packageName) {
  const result = run(adb, [
    '-s',
    serial,
    'shell',
    'dumpsys',
    'package',
    packageName,
  ]);
  if (result.status !== 0 || !result.stdout.includes(`Package [${packageName}`))
    return null;
  const versionCode = Number(result.stdout.match(/versionCode=(\d+)/)?.[1]);
  const versionName = result.stdout.match(/versionName=([^\s]+)/)?.[1] ?? '';
  const debuggable =
    run(adb, ['-s', serial, 'shell', 'run-as', packageName, 'id']).status === 0;
  return { versionCode, versionName, debuggable };
}

const serial = waitForBoot();
if (!serial) process.exit(0);

const config = getExpoConfig();
const packageName = config.android?.package;
const versionCode = Number(config.android?.versionCode);
const versionName = config.version;
if (!packageName || !Number.isInteger(versionCode) || !versionName)
  throw new Error('Expo Android package/version 配置不完整');

const homeKeystore = resolve(homedir(), '.android/debug.keystore');
const projectKeystore = resolve(mobile, 'android/app/debug.keystore');
const keystorePath =
  process.env.ANDROID_DEBUG_KEYSTORE_FILE ||
  (existsSync(homeKeystore) ? homeKeystore : projectKeystore);
const fingerprint = nativeFingerprint(config, keystorePath);
const statePath = resolve(mobile, '.expo/android-dev-client.json');
let savedState = null;
try {
  savedState = JSON.parse(readFileSync(statePath, 'utf8'));
} catch {}

const installed = installedPackage(serial, packageName);
const current =
  installed?.debuggable &&
  installed.versionCode === versionCode &&
  installed.versionName === versionName &&
  savedState?.applicationId === packageName &&
  savedState?.versionCode === versionCode &&
  savedState?.versionName === versionName &&
  savedState?.nativeFingerprint === fingerprint;

if (process.env.QINGGAI_ANDROID_DEV_CLIENT_CHECK_ONLY === '1') {
  console.log(
    current
      ? `当前开发版已匹配：${packageName} ${versionName} (${versionCode})。`
      : '当前开发版需要构建或更新。',
  );
  process.exit(current ? 0 : 2);
}

if (!current) {
  if (installed?.versionCode > versionCode) {
    throw new Error(
      `模拟器已安装更高版本 ${installed.versionName} (${installed.versionCode})；为避免降级或清除本机数据，已停止自动安装。`,
    );
  }
  console.log('当前安装包不是匹配源码的开发版，开始构建并更新安装。');
  const env = { ...process.env };
  if (keystorePath && existsSync(keystorePath))
    env.ANDROID_DEBUG_KEYSTORE_FILE = keystorePath;
  const build = spawnSync(
    'pnpm',
    [
      '--filter',
      '@qinggairugu/mobile',
      'exec',
      'expo',
      'run:android',
      '--no-bundler',
      '--device',
      serial,
    ],
    { cwd: root, env, stdio: 'inherit' },
  );
  if (build.error) throw build.error;
  if (build.status !== 0) process.exit(build.status ?? 1);
}

const verified = installedPackage(serial, packageName);
if (
  !verified?.debuggable ||
  verified.versionCode !== versionCode ||
  verified.versionName !== versionName
) {
  throw new Error('Android 开发版安装后校验失败');
}

if (!current || process.env.QINGGAI_ANDROID_CLEAN_AFTER_INSTALL === '1') {
  const apkPath = resolve(
    mobile,
    'android/app/build/outputs/apk/debug/app-debug.apk',
  );
  if (!existsSync(apkPath)) throw new Error('找不到已安装的 Android 调试 APK');
  const artifactDirectory = resolve(root, 'artifacts/android/dev');
  const artifactPath = resolve(artifactDirectory, 'qinggai-debug.apk');
  mkdirSync(artifactDirectory, { recursive: true });
  copyFileSync(apkPath, artifactPath);
  const checksum = createHash('sha256')
    .update(readFileSync(artifactPath))
    .digest('hex');
  writeFileSync(`${artifactPath}.sha256`, `${checksum}  qinggai-debug.apk\n`);
  writeFileSync(
    `${artifactPath}.json`,
    `${JSON.stringify(
      {
        applicationId: packageName,
        versionName,
        versionCode,
        variant: 'debug',
        purpose: 'Expo 本地开发客户端',
        device: serial,
        sha256: checksum,
        builtAt: new Date().toISOString(),
      },
      null,
      2,
    )}\n`,
  );

  const gradleWrapper = resolve(mobile, 'android/gradlew');
  const clean = spawnSync(gradleWrapper, ['clean'], {
    cwd: resolve(mobile, 'android'),
    env: process.env,
    stdio: 'inherit',
  });
  if (clean.error || clean.status !== 0)
    console.warn('开发版已安装，但 Gradle 中间产物清理未完成；保留现有缓存。');
  else console.log('已清理 Android 可再生成构建产物，保留本地增量缓存。');
}

mkdirSync(dirname(statePath), { recursive: true });
const tempState = `${statePath}.tmp`;
writeFileSync(
  tempState,
  `${JSON.stringify(
    {
      applicationId: packageName,
      versionName,
      versionCode,
      nativeFingerprint: fingerprint,
      deviceSerial: serial,
    },
    null,
    2,
  )}\n`,
);
renameSync(tempState, statePath);
console.log(
  `Android 开发版已就绪：${packageName} ${versionName} (${versionCode})，设备 ${serial}。`,
);
