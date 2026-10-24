import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

export const releaseManifestPath = 'apps/mobile/release-manifest.json';
export const androidArchitectures = ['arm64-v8a', 'armeabi-v7a'];
const semver = /^\d+\.\d+\.\d+$/;
const digest = /^[a-f0-9]{64}$/;

export class AndroidReleaseError extends Error {}

export function resolveAndroidBuild(root, environment = process.env) {
  const api = new URL(
    environment.EXPO_PUBLIC_API_URL || 'https://qgrg.bebackpacker.com',
  );
  if (
    api.protocol !== 'https:' ||
    api.username ||
    api.password ||
    api.search ||
    api.hash
  )
    throw new AndroidReleaseError('Release API 必须使用不含凭据的 HTTPS 地址');
  const env = {
    ...environment,
    NODE_ENV: 'production',
    EXPO_PUBLIC_API_URL: api.href.replace(/\/$/, ''),
    CI: '1',
  };
  const mobile = resolve(root, 'apps/mobile');
  const expoCli = createRequire(resolve(mobile, 'package.json')).resolve(
    'expo/bin/cli',
  );
  const config = JSON.parse(
    execFileSync(
      process.execPath,
      [expoCli, 'config', '--type', 'public', '--json'],
      { cwd: mobile, env, encoding: 'utf8' },
    ),
  );
  if (
    !semver.test(config.version) ||
    !Number.isSafeInteger(config.android?.versionCode) ||
    config.android.versionCode < 1 ||
    !config.android.package
  )
    throw new AndroidReleaseError('Android 版本号、versionCode 或包名无效');
  return { config, env, expoCli, api: env.EXPO_PUBLIC_API_URL };
}

/** 仅覆盖 App 构建输入；后端、官网、文档变化无需重新打 APK。 */
export function androidSourceHash(root, config, api) {
  const files = [];
  const ignored = new Set([
    'node_modules',
    'dist',
    '.turbo',
    '.expo',
    'android',
    'ios',
    'coverage',
    '.DS_Store',
    '__tests__',
    '__fixtures__',
  ]);
  function visit(relative) {
    const path = resolve(root, relative);
    if (!existsSync(path)) return;
    for (const entry of readdirSync(path, { withFileTypes: true })) {
      if (
        ignored.has(entry.name) ||
        entry.name.startsWith('.env') ||
        /\.(test|spec)\./.test(entry.name)
      )
        continue;
      const child = `${relative}/${entry.name}`;
      if (entry.isDirectory()) visit(child);
      else if (entry.isFile()) files.push(child);
      else
        throw new AndroidReleaseError(`App 构建目录不支持符号链接：${child}`);
    }
  }
  for (const directory of [
    'apps/mobile/app',
    'apps/mobile/src',
    'apps/mobile/assets',
    'apps/mobile/plugins',
    'patches',
    ...['ai', 'contracts', 'shared', 'design-tokens', 'config'].map(
      (name) => `packages/${name}`,
    ),
  ])
    visit(directory);
  files.push(
    'apps/mobile/app.config.ts',
    'apps/mobile/package.json',
    'apps/mobile/tsconfig.json',
    'pnpm-lock.yaml',
    'pnpm-workspace.yaml',
    'scripts/build-android-release.mjs',
    'scripts/lib/android-release.mjs',
  );
  const hash = createHash('sha256');
  const rootPackage = JSON.parse(
    readFileSync(resolve(root, 'package.json'), 'utf8'),
  );
  hash.update(
    JSON.stringify({
      config,
      api,
      architectures: androidArchitectures,
      packageManager: rootPackage.packageManager,
      engines: rootPackage.engines,
      pnpm: rootPackage.pnpm,
    }),
  );
  for (const file of [...new Set(files)].sort()) {
    const bytes = readFileSync(resolve(root, file));
    hash.update(`\0${file}\0${bytes.length}\0`);
    hash.update(bytes);
  }
  return hash.digest('hex');
}

export function readCurrentAndroidRelease(root, config, api) {
  let manifest;
  try {
    manifest = JSON.parse(
      readFileSync(resolve(root, releaseManifestPath), 'utf8'),
    );
  } catch {
    throw new AndroidReleaseError(
      '缺少有效的 APK 构建清单，请先执行 pnpm android:build，再执行 pnpm android:publish。',
    );
  }
  if (
    manifest?.schemaVersion !== 1 ||
    !semver.test(manifest.version) ||
    !digest.test(manifest.sha256) ||
    !digest.test(manifest.sourceHash) ||
    !Number.isSafeInteger(manifest.bytes) ||
    manifest.bytes <= 0 ||
    manifest.filename !== `qinggai-${manifest.version}-release.apk`
  )
    throw new AndroidReleaseError(
      'APK 构建清单无效，请执行 pnpm android:build 重新生成。',
    );
  if (
    manifest.version !== config.version ||
    manifest.versionCode !== config.android.versionCode ||
    manifest.package !== config.android.package ||
    manifest.api !== api ||
    manifest.sourceHash !== androidSourceHash(root, config, api)
  )
    throw new AndroidReleaseError(
      '当前 App 源码、图标、依赖或构建配置已变化，已有 APK 不是最新构建。请提升 version / versionCode 后执行 pnpm android:build 和 pnpm android:publish。',
    );
  return manifest;
}

export async function checkOnlineAndroidRelease(manifest, request = fetch) {
  const base = new URL(manifest.api).origin;
  let metadata;
  try {
    const response = await request(`${base}/downloads/release.json`, {
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error();
    metadata = await response.json();
    if (!semver.test(metadata?.version)) throw new Error();
  } catch {
    throw new AndroidReleaseError(
      '无法确认官网最新 APK 版本，请检查 /downloads/release.json 和网络后重试。',
    );
  }
  if (metadata.version !== manifest.version)
    throw new AndroidReleaseError(
      `线上 APK 为 ${metadata.version}，当前应为 ${manifest.version}。请先执行 pnpm android:publish，官网可下载最新 APK 后再部署。`,
    );
  if (metadata.bytes !== null && metadata.bytes !== manifest.bytes)
    throw new AndroidReleaseError(
      '线上 APK 大小与当前构建不一致，请检查 GitCode 发布附件，修复后再部署。',
    );

  const hash = createHash('sha256');
  let bytes = 0;
  const signal = AbortSignal.timeout(180_000);
  try {
    let target = `${base}/download/android`;
    for (let hop = 0; hop <= 8; hop++) {
      const response = await request(target, {
        cache: 'no-store',
        redirect: 'manual',
        signal,
      });
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        await response.body?.cancel();
        const next = new URL(response.headers.get('location') || '', target);
        if (next.protocol !== 'https:' || next.username || next.password)
          throw new Error();
        target = next.href;
        continue;
      }
      if (
        !response.ok ||
        !response.body ||
        response.headers.get('content-type')?.includes('text/html')
      ) {
        await response.body?.cancel();
        throw new Error();
      }
      for await (const chunk of response.body) {
        bytes += chunk.byteLength;
        if (bytes > manifest.bytes) throw new Error();
        hash.update(chunk);
      }
      if (bytes !== manifest.bytes || hash.digest('hex') !== manifest.sha256)
        throw new Error();
      return;
    }
    throw new Error();
  } catch {
    // 不输出网络异常，避免临时 CDN 签名地址进入日志。
    throw new AndroidReleaseError(
      '官网下载的 APK 无法通过当前构建的大小 / SHA256 校验。请检查网络和 GitCode 附件，确保 pnpm android:publish 成功后再部署。',
    );
  }
}

/** ZIP 对齐不代表 ELF 对齐；正式构建必须逐个验证 64 位原生库。 */
export function assert16KBElf(buffer, name = '原生库') {
  const fail = (message) => {
    throw new AndroidReleaseError(`${name}：${message}`);
  };
  if (
    buffer.length < 64 ||
    buffer.readUInt32LE(0) !== 0x464c457f ||
    buffer[4] !== 2 ||
    buffer[5] !== 1
  )
    fail('不是可验证的 64 位小端 ELF');
  const offset = buffer.readBigUInt64LE(32);
  const size = buffer.readUInt16LE(54),
    count = buffer.readUInt16LE(56);
  if (
    offset > BigInt(Number.MAX_SAFE_INTEGER) ||
    Number(offset) < 64 ||
    size < 56 ||
    !count ||
    Number(offset) + size * count > buffer.length
  )
    fail('ELF 段表不完整');
  let segments = 0;
  for (let index = 0; index < count; index++) {
    const start = Number(offset) + index * size;
    if (buffer.readUInt32LE(start) !== 1) continue;
    segments++;
    const alignment = buffer.readBigUInt64LE(start + 48);
    const fileOffset = buffer.readBigUInt64LE(start + 8),
      address = buffer.readBigUInt64LE(start + 16);
    if (
      alignment < 16384n ||
      (alignment & (alignment - 1n)) !== 0n ||
      fileOffset % 16384n !== address % 16384n
    )
      fail('LOAD 段未按 16 KB 对齐，请更新或重新编译该库');
  }
  if (!segments) fail('缺少 LOAD 段');
  return segments;
}
