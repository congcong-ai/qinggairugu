import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  copyFileSync,
  chmodSync,
  rmSync,
  existsSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  androidSourceHash,
  readCurrentAndroidRelease,
  checkOnlineAndroidRelease,
  releaseManifestPath,
  assert16KBElf,
} from './lib/android-release.mjs';

const project = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const api = 'https://qgrg.bebackpacker.com';
const config = {
  version: '0.1.2',
  android: { versionCode: 3, package: 'com.xixisys.pengtou' },
};
const apk = Buffer.from('PK\x03\x04测试安装包内容');
let root;

function write(path, value) {
  const target = resolve(root, path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, value);
}

function manifest() {
  return {
    schemaVersion: 1,
    version: config.version,
    versionCode: config.android.versionCode,
    package: config.android.package,
    api,
    filename: `qinggai-${config.version}-release.apk`,
    bytes: apk.length,
    sha256: createHash('sha256').update(apk).digest('hex'),
    sourceHash: androidSourceHash(root, config, api),
  };
}

function online({
  version = config.version,
  bytes = apk.length,
  body = apk,
  html = false,
} = {}) {
  return vi.fn(async (url) => {
    if (url.endsWith('/downloads/release.json'))
      return Response.json({ version, bytes });
    if (url.endsWith('/download/android'))
      return new Response(null, {
        status: 302,
        headers: {
          Location: 'https://cdn.example.com/new.apk?signature=private',
        },
      });
    return new Response(body, {
      headers: {
        'Content-Type': html
          ? 'text/html'
          : 'application/vnd.android.package-archive',
      },
    });
  });
}

beforeEach(() => {
  root = mkdtempSync(resolve(tmpdir(), 'qinggai-apk-check-'));
  write(
    'package.json',
    JSON.stringify({
      packageManager: 'pnpm@11.17.0',
      engines: { node: '>=22' },
    }),
  );
  for (const path of [
    'apps/mobile/app.config.ts',
    'apps/mobile/package.json',
    'apps/mobile/tsconfig.json',
    'pnpm-lock.yaml',
    'pnpm-workspace.yaml',
    'scripts/build-android-release.mjs',
    'scripts/lib/android-release.mjs',
  ])
    write(path, '构建输入');
  write('apps/mobile/assets/icon.png', '原始图标');
  write('apps/mobile/app/index.tsx', '首页');
  write('packages/ai/src/index.ts', 'AI 实现');
});

afterEach(() => rmSync(root, { recursive: true, force: true }));

describe('App 源码与构建清单', () => {
  it('识别当前构建，并在图标更改后拒绝使用旧 APK', () => {
    const release = manifest();
    write(releaseManifestPath, JSON.stringify(release));
    expect(readCurrentAndroidRelease(root, config, api)).toEqual(release);
    write('apps/mobile/assets/icon.png', '新的品牌 Logo');
    expect(() => readCurrentAndroidRelease(root, config, api)).toThrow(
      '已有 APK 不是最新构建',
    );
  });

  it('共享依赖变化触发重打包，后端和文档变化不触发', () => {
    const hash = androidSourceHash(root, config, api);
    write('apps/api/src/index.ts', '后端变化');
    write('docs/PRODUCTION_DEPLOYMENT.md', '文档变化');
    write('packages/ai/src/ai.test.ts', '测试变化');
    expect(androidSourceHash(root, config, api)).toBe(hash);
    write('packages/ai/src/index.ts', 'AI 实现发生变化');
    expect(androidSourceHash(root, config, api)).not.toBe(hash);
  });

  it('构建清单缺失或版本 / 公共 API 配置变化时拒绝部署', () => {
    expect(() => readCurrentAndroidRelease(root, config, api)).toThrow(
      'pnpm android:build',
    );
    write(releaseManifestPath, JSON.stringify(manifest()));
    expect(() =>
      readCurrentAndroidRelease(root, { ...config, version: '0.1.3' }, api),
    ).toThrow('不是最新构建');
    expect(() =>
      readCurrentAndroidRelease(root, config, 'https://other.example.com'),
    ).toThrow('不是最新构建');
  });
});

describe('官网实际下载检查', () => {
  it('官网版本、大小和经过重定向的 APK 哈希全部一致才通过', async () => {
    const request = online();
    await expect(
      checkOnlineAndroidRelease(manifest(), request),
    ).resolves.toBeUndefined();
    expect(request).toHaveBeenCalledTimes(3);
  });

  it('线上旧版本立即终止，不下载旧包', async () => {
    const request = online({ version: '0.1.1' });
    await expect(
      checkOnlineAndroidRelease(manifest(), request),
    ).rejects.toThrow('线上 APK 为 0.1.1，当前应为 0.1.2');
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('版本和大小相同但文件不同也拒绝部署', async () => {
    await expect(
      checkOnlineAndroidRelease(
        manifest(),
        online({ body: Buffer.alloc(apk.length, 1) }),
      ),
    ).rejects.toThrow('SHA256');
  });

  it('文件大小不符、HTML 回退页面和网络故障均拒绝部署', async () => {
    await expect(
      checkOnlineAndroidRelease(manifest(), online({ bytes: 1 })),
    ).rejects.toThrow('大小');
    await expect(
      checkOnlineAndroidRelease(manifest(), online({ html: true })),
    ).rejects.toThrow('SHA256');
    await expect(
      checkOnlineAndroidRelease(manifest(), async () => {
        throw new Error('https://cdn.example.com?secret=private');
      }),
    ).rejects.toThrow('无法确认官网最新 APK 版本');
  });

  it('拒绝下载到 HTTP 的跳转，不泄漏 CDN 签名 URL', async () => {
    const request = online();
    request.mockImplementationOnce(async () =>
      Response.json({ version: config.version, bytes: apk.length }),
    );
    request.mockImplementationOnce(
      async () =>
        new Response(null, {
          status: 302,
          headers: { Location: 'http://cdn.example.com?secret=private' },
        }),
    );
    await expect(
      checkOnlineAndroidRelease(manifest(), request),
    ).rejects.toThrow('SHA256');
    expect(request).toHaveBeenCalledTimes(2);
  });
});

it('server:deploy 在 APK 检查失败时退出，SSH 和上传均未执行', () => {
  write('scripts/check-android-release.mjs', '');
  for (const name of [
    'scripts/deploy-remote.sh',
    'scripts/lib/deploy-target.sh',
  ])
    copyFileSync(resolve(project, name), resolve(root, name));
  write(
    'bin/node',
    '#!/bin/sh\ncase "$1" in */check-android-release.mjs) echo "模拟 APK 检查失败" >&2; exit 7;; esac\nexec "$QINGGAI_TEST_NODE" "$@"\n',
  );
  for (const name of ['ssh', 'scp'])
    write(
      `bin/${name}`,
      '#!/bin/sh\necho "不应执行远端操作" >> "$QINGGAI_TEST_MARKER"\nexit 99\n',
    );
  for (const name of ['node', 'ssh', 'scp'])
    chmodSync(resolve(root, 'bin', name), 0o755);
  const marker = resolve(root, 'remote-operations');
  const result = spawnSync(
    'bash',
    [resolve(root, 'scripts/deploy-remote.sh')],
    {
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: `${resolve(root, 'bin')}:${process.env.PATH}`,
        QINGGAI_TEST_NODE: process.execPath,
        QINGGAI_TEST_MARKER: marker,
      },
    },
  );
  expect(result.status).toBe(7);
  expect(result.stderr).toContain('模拟 APK 检查失败');
  expect(existsSync(marker)).toBe(false);
});

function elfFixture(alignment) {
  const bytes = Buffer.alloc(120);
  bytes.writeUInt32LE(0x464c457f, 0);
  bytes[4] = 2;
  bytes[5] = 1;
  bytes.writeBigUInt64LE(64n, 32);
  bytes.writeUInt16LE(56, 54);
  bytes.writeUInt16LE(1, 56);
  bytes.writeUInt32LE(1, 64);
  bytes.writeBigUInt64LE(BigInt(alignment), 112);
  return bytes;
}
it('正式 APK 检查拒绝 4 KB ELF，即使 ZIP 本身已对齐', () => {
  expect(() => assert16KBElf(elfFixture(4096), 'vec.so')).toThrow('16 KB');
  expect(assert16KBElf(elfFixture(16384))).toBe(1);
});
it('截断段表和错误文件不能作为合格原生库', () => {
  expect(() => assert16KBElf(Buffer.from('not ELF'))).toThrow('ELF');
  expect(() => assert16KBElf(elfFixture(16384).subarray(0, 100))).toThrow(
    '段表',
  );
});
