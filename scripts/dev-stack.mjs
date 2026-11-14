import { spawn, spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const emulatorStart = spawnSync(
  process.execPath,
  [resolve(root, 'scripts/start-android-emulator.mjs')],
  { cwd: root, env: process.env, stdio: 'inherit' },
);
if (emulatorStart.error) throw emulatorStart.error;

console.log('已检查 Android 模拟器，正在构建官网并启动倾盖如故完整开发环境。');

const build = spawnSync('pnpm', ['build:web'], {
  cwd: root,
  env: process.env,
  stdio: 'inherit',
});
if (build.error) throw build.error;
if (build.status !== 0) process.exit(build.status ?? 1);

console.log('检查并安装当前 Android 开发版（原生配置未变时复用已安装版本）。');
const ensureAndroid = spawnSync(
  process.execPath,
  [resolve(root, 'scripts/ensure-android-dev-client.mjs')],
  { cwd: root, env: process.env, stdio: 'inherit' },
);
if (ensureAndroid.error) throw ensureAndroid.error;
if (ensureAndroid.status !== 0) process.exit(ensureAndroid.status ?? 1);

console.log('官网：http://localhost:3000');
console.log('API：http://localhost:9001');
console.log('App：Expo Dev Client / 8082');
console.log('微信小程序：Taro watch 自动更新 apps/miniapp/dist');

const tasks = [
  {
    name: 'API、App 与微信小程序',
    command: 'pnpm',
    args: ['exec', 'turbo', 'dev'],
  },
  {
    name: '官网预览',
    command: process.execPath,
    args: [
      'scripts/dev.mjs',
      '3000',
      'pnpm',
      '--filter',
      '@qinggairugu/api',
      'exec',
      'tsx',
      'src/website-preview.ts',
    ],
  },
  {
    name: '官网自动构建',
    command: process.execPath,
    args: ['scripts/watch-web.mjs'],
  },
];

const children = new Set();
let stopping = false;
let forceStopTimer;

function signalTask(child, signal) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  try {
    child.kill(signal);
  } catch (error) {
    if (error.code !== 'ESRCH') console.error(error);
  }
}

function forceStopTask(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  try {
    if (process.platform === 'win32') child.kill('SIGKILL');
    else process.kill(-child.pid, 'SIGKILL');
  } catch (error) {
    if (error.code !== 'ESRCH') console.error(error);
  }
}

function maybeExit() {
  if (!stopping || children.size > 0) return;
  clearTimeout(forceStopTimer);
}

function stopAll(signal, exitCode) {
  if (stopping) return;
  stopping = true;
  process.exitCode = exitCode;
  for (const child of children) signalTask(child, signal);
  forceStopTimer = setTimeout(() => {
    for (const child of children) forceStopTask(child);
  }, 10000);
  forceStopTimer.unref();
  maybeExit();
}

process.on('SIGINT', () => stopAll('SIGINT', 0));
process.on('SIGTERM', () => stopAll('SIGTERM', 143));

for (const task of tasks) {
  const child = spawn(task.command, task.args, {
    cwd: root,
    env: process.env,
    stdio: 'inherit',
    detached: process.platform !== 'win32',
  });
  children.add(child);
  child.once('error', (error) => {
    console.error(`[${task.name}] 启动失败：${error.message}`);
    children.delete(child);
    stopAll('SIGTERM', 1);
    maybeExit();
  });
  child.once('close', (code, signal) => {
    children.delete(child);
    if (!stopping) {
      console.error(
        `[${task.name}] 已退出（${signal ?? `exit ${code ?? 1}`}），正在停止其它开发服务。`,
      );
      stopAll('SIGTERM', code === 0 ? 1 : (code ?? 1));
    }
    maybeExit();
  });
}
