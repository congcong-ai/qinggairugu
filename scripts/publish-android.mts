import { createHash } from 'node:crypto';
import { createReadStream, existsSync, readFileSync } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gitCodeFromEnv } from '../apps/api/src/releases/gitcode';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
if (existsSync(resolve(root, '.env')))
  process.loadEnvFile(resolve(root, '.env'));
async function digestFile(path: string) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest('hex');
}
async function digestRemote(url: string) {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(5 * 60_000),
      redirect: 'follow',
    });
    if (!response.ok || !response.body) throw new Error();
    const hash = createHash('sha256');
    for await (const chunk of response.body) hash.update(chunk);
    return hash.digest('hex');
  } catch {
    throw new Error('远端附件校验失败，本地文件已保留');
  }
}
async function main() {
  if (process.argv.includes('--help')) {
    console.log(
      '用法：pnpm android:publish\n将 artifacts/android/release.json 对应的 APK 和 SHA256 上传 GitCode Release，并下载核验。需要根目录 .env 中的 GITCODE_OWNER、GITCODE_REPO、GITCODE_TOKEN。',
    );
    return;
  }
  if (process.argv.length > 2) throw new Error('此命令不接受参数');
  if (!process.env.GITCODE_TOKEN)
    throw new Error('请在根目录 .env 配置 GITCODE_TOKEN');
  const provider = gitCodeFromEnv();
  const directory = resolve(root, 'artifacts/android');
  const release = JSON.parse(
    readFileSync(resolve(directory, 'release.json'), 'utf8'),
  );
  if (
    !/^\d+\.\d+\.\d+$/.test(release.version) ||
    release.filename !== `qinggai-${release.version}-release.apk`
  )
    throw new Error('APK 发布清单无效');
  const apkPath = resolve(directory, release.filename);
  const bytes = readFileSync(apkPath);
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  if (sha256 !== release.sha256 || bytes.length !== release.bytes)
    throw new Error('APK 大小或 SHA256 与清单不一致');
  const temp = await mkdtemp(resolve(tmpdir(), 'qinggai-gitcode-'));
  const checksumPath = resolve(temp, `${release.filename}.sha256`);
  await writeFile(checksumPath, `${sha256}  ${release.filename}\n`);
  try {
    const tag = `v${release.version}`;
    await provider.createOrGetRelease(release.version);
    for (const [name, path] of [
      [release.filename, apkPath],
      [`${release.filename}.sha256`, checksumPath],
    ] as const) {
      const existing = (await provider.getRelease(tag)).assets.filter(
        (item) => item.name === name,
      );
      if (existing.length > 1) throw new Error('远端存在重复附件，请检查仓库');
      const digest = await digestFile(path);
      if (existing[0]) {
        const url = await provider.downloadUrl(existing[0]);
        if (!url || (await digestRemote(url)) !== digest)
          throw new Error(
            '远端同名附件内容不同，请提升版本号后重新发布；不会覆盖已有附件',
          );
        console.log(`相同附件已存在，跳过：${name}`);
      } else {
        await provider.upload(tag, name, path);
        let verified = false;
        for (let attempt = 0; attempt < 4; attempt++) {
          const asset = (await provider.getRelease(tag)).assets.find(
            (item) => item.name === name,
          );
          const url = asset && (await provider.downloadUrl(asset));
          if (url) {
            if ((await digestRemote(url)) !== digest)
              throw new Error('远端附件 SHA256 校验不一致');
            verified = true;
            break;
          }
          if (attempt < 3)
            await new Promise((resolve) =>
              setTimeout(resolve, 1000 * (attempt + 1)),
            );
        }
        if (!verified)
          throw new Error('上传后未能验证附件，请检查 GitCode Release 后重试');
        console.log(`上传并通过远端 SHA256 校验：${name}`);
      }
    }
    console.log(
      `Android ${tag} 已发布：${provider.page}/${tag}\n本地安装包已保留。`,
    );
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
}
main().catch((error: unknown) => {
  // 不打印网络异常原文，防止 API Token 和签名 URL 进入终端或日志。
  const known =
    error instanceof Error &&
    !error.message.includes('https:') &&
    !error.message.includes(process.env.GITCODE_TOKEN || '\0')
      ? error.message
      : 'GitCode 发布失败，请检查配置与网络';
  console.error(known);
  process.exitCode = 1;
});
