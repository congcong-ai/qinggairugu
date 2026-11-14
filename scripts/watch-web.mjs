import { watch } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let timer;

function rebuild() {
  const result = spawnSync(
    process.execPath,
    [resolve(root, 'scripts/build-web.mjs')],
    { cwd: root, env: process.env, stdio: 'inherit' },
  );
  if (result.error) console.error(`官网构建启动失败：${result.error.message}`);
  else if (result.status !== 0)
    console.error(`官网构建失败，退出码：${result.status ?? 1}`);
}

function scheduleBuild() {
  clearTimeout(timer);
  timer = setTimeout(rebuild, 250);
}

function addWatcher(path, options, shouldBuild) {
  const watcher = watch(path, options, (_eventType, filename) => {
    if (filename && shouldBuild(filename.toString().replaceAll('\\', '/')))
      scheduleBuild();
  });
  watcher.on('error', (error) => {
    console.error(`官网文件监听失败：${error.message}`);
    process.exit(1);
  });
}

addWatcher(
  resolve(root, 'apps/web'),
  { recursive: true },
  (filename) => filename !== 'dist' && !filename.startsWith('dist/'),
);
addWatcher(
  resolve(root, 'scripts'),
  {},
  (filename) =>
    filename === 'build-web.mjs' || filename === 'build-product-pages.mjs',
);
addWatcher(
  resolve(root, 'docs'),
  {},
  (filename) =>
    filename === 'PRIVACY_POLICY.md' || filename === 'TERMS_OF_SERVICE.md',
);

console.log('官网文件监听已启动，源码变化会自动重新构建。');
