import { existsSync, readFileSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const mobileRoot = resolve(
  fileURLToPath(new URL('.', import.meta.url)),
  '../apps/mobile',
);
const rootDevRunner = resolve(mobileRoot, '../../scripts/dev.mjs');
const sdkRoot =
  process.env.ANDROID_SDK_ROOT ||
  process.env.ANDROID_HOME ||
  (process.platform === 'darwin'
    ? resolve(homedir(), 'Library/Android/sdk')
    : process.platform === 'win32'
      ? resolve(process.env.LOCALAPPDATA ?? homedir(), 'Android/Sdk')
      : resolve(homedir(), 'Android/Sdk'));
const adb = resolve(sdkRoot, 'platform-tools/adb');
let state = null;
try {
  state = JSON.parse(
    readFileSync(resolve(mobileRoot, '.expo/android-dev-client.json'), 'utf8'),
  );
} catch {}
const devices = existsSync(adb)
  ? spawnSync(adb, ['devices'], { encoding: 'utf8' })
  : null;
const emulatorSerials = (devices?.stdout ?? '')
  .split(/\r?\n/)
  .map((line) => line.trim().split(/\s+/))
  .filter(
    ([serial, status]) =>
      /^emulator-\d+$/.test(serial ?? '') && status === 'device',
  )
  .map(([serial]) => serial);
const emulatorSerial = emulatorSerials.includes(state?.deviceSerial)
  ? state.deviceSerial
  : emulatorSerials[0];
const args = [
  rootDevRunner,
  '8082',
  'expo',
  'start',
  '--dev-client',
  '--port',
  '8082',
];
const env = { ...process.env };
if (state && emulatorSerial) {
  args.push('--android');
  env.ANDROID_SERIAL = emulatorSerial;
}

const child = spawn(process.execPath, args, {
  cwd: mobileRoot,
  env,
  stdio: 'inherit',
});
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () => child.kill(signal));
child.once('error', (error) => {
  console.error(`启动 Expo 开发服务失败：${error.message}`);
  process.exitCode = 1;
});
child.once('exit', (code, signal) => {
  process.exitCode = code ?? (signal === 'SIGINT' ? 0 : 1);
});
