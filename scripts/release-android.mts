import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const commands = [
  {
    label: '上传已校验的 Android APK 到 GitCode Release',
    args: ['android:publish'],
  },
  {
    label: '校验 APK 并更新官网',
    args: ['server:deploy', 'china'],
  },
];

if (process.argv.slice(2).some((arg) => arg === '--help' || arg === '-h')) {
  console.log(
    '用法：pnpm android:release\n先发布 artifacts/android 中与当前 App 源码匹配的 APK 到 GitCode Release，再检查官网将提供的 APK 并部署官网。需要根目录 .env 配置 GitCode 凭据，以及 .deploy.env 配置 China 部署目标。',
  );
  process.exit(0);
}
if (process.argv.length > 2) {
  console.error(
    '此命令不接受参数；运行 pnpm android:release -- --help 查看说明。',
  );
  process.exit(2);
}

for (const [index, command] of commands.entries()) {
  console.log(`\n[${index + 1}/${commands.length}] ${command.label}`);
  const result = spawnSync('pnpm', command.args, {
    cwd: root,
    stdio: 'inherit',
  });
  if (result.error) {
    console.error(`启动失败：${command.label}`);
    process.exit(1);
  }
  if (result.status !== 0) {
    console.error(
      `步骤未完成（退出码 ${result.status ?? result.signal}）：${command.label}`,
    );
    if (index === 0)
      console.error('GitCode 上传未完成，官网未部署；修复后重试同一命令。');
    else console.error('APK 已保留在 GitCode；修复官网部署后重试同一命令。');
    process.exit(result.status ?? 1);
  }
}

console.log('\nAndroid APK 已发布到 GitCode，官网已更新并通过线上 APK 校验。');
