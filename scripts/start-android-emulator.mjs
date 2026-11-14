import { existsSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { createServer } from 'node:net';

function defaultSdkRoot() {
  if (process.platform === 'darwin')
    return resolve(homedir(), 'Library/Android/sdk');
  if (process.platform === 'win32')
    return resolve(process.env.LOCALAPPDATA ?? homedir(), 'Android/Sdk');
  return resolve(homedir(), 'Android/Sdk');
}

function run(command, args) {
  return spawnSync(command, args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: process.env,
  });
}

function available(port) {
  return new Promise((resolvePort) => {
    const server = createServer();
    server.once('error', () => resolvePort(false));
    server.listen(port, '127.0.0.1', () =>
      server.close(() => resolvePort(true)),
    );
  });
}

const sdkRoot =
  process.env.ANDROID_SDK_ROOT || process.env.ANDROID_HOME || defaultSdkRoot();
const adb = resolve(sdkRoot, 'platform-tools/adb');
const emulator = resolve(sdkRoot, 'emulator/emulator');
if (!existsSync(adb) || !existsSync(emulator)) {
  console.warn('未找到 Android SDK 模拟器，继续启动其它开发服务。');
  process.exit(0);
}

const deviceList = run(adb, ['devices']);
if (deviceList.status !== 0) {
  console.warn('无法查询 Android 设备，继续启动其它开发服务。');
  process.exit(0);
}
const runningEmulator = deviceList.stdout
  .split(/\r?\n/)
  .map((line) => line.trim().split(/\s+/)[0])
  .find((serial) => /^emulator-\d+$/.test(serial ?? ''));
if (runningEmulator) {
  console.log(`检测到模拟器 ${runningEmulator} 已打开，不重复启动。`);
  process.exit(0);
}

const avdResult = run(emulator, ['-list-avds']);
const avds = avdResult.stdout
  .split(/\r?\n/)
  .map((name) => name.trim())
  .filter(Boolean);
const preferredAvd =
  process.arch === 'x64'
    ? 'qinggai-review-api36'
    : 'qinggai-review-arm64-api36';
const avd = process.env.ANDROID_AVD_NAME
  ? avds.includes(process.env.ANDROID_AVD_NAME)
    ? process.env.ANDROID_AVD_NAME
    : undefined
  : avds.includes(preferredAvd)
    ? preferredAvd
    : avds[0];
if (!avd) {
  console.warn(
    '没有找到可用的 Android 虚拟设备；可安装/创建 AVD 后重试。其它开发服务仍会启动。',
  );
  process.exit(0);
}

let port;
for (let candidate = 5554; candidate <= 5680; candidate += 2) {
  if ((await available(candidate)) && (await available(candidate + 1))) {
    port = candidate;
    break;
  }
}
if (!port) {
  console.warn('Android 模拟器控制端口均被占用，继续启动其它开发服务。');
  process.exit(0);
}

const child = spawn(emulator, ['-avd', avd, '-port', String(port)], {
  detached: true,
  env: process.env,
  stdio: 'ignore',
});
await new Promise((resolveSpawn, rejectSpawn) => {
  child.once('spawn', resolveSpawn);
  child.once('error', rejectSpawn);
});
child.unref();
console.log(
  `已启动 Android 模拟器 ${avd}（端口 ${port}）；首次开机可能需要一点时间。`,
);
