import { z } from 'zod';

const assetSchema = z.object({
  name: z.string(),
  browser_download_url: z.string().optional(),
  size: z.coerce.number().nonnegative().optional(),
});
const releaseSchema = z.object({
  tag_name: z.string(),
  assets: z.array(assetSchema).default([]),
  prerelease: z.boolean().optional(),
  draft: z.boolean().optional(),
  release_status: z.string().optional(),
});
export type GitCodeRelease = z.infer<typeof releaseSchema>;
export type GitCodeAsset = z.infer<typeof assetSchema>;
export class GitCodeApiError extends Error {
  constructor(public readonly status: number) {
    super(`GitCode 请求失败（HTTP ${status}）`);
  }
}

/** API Token 只用于 GitCode API，绝不转发到附件、CDN 或浏览器。 */
export class GitCodeReleases {
  private readonly base: string;
  readonly page: string;
  constructor(
    private readonly config: { owner: string; repo: string; token?: string },
    private readonly request: typeof fetch = fetch,
  ) {
    const slug = /^[a-zA-Z0-9_.-]+$/;
    if (!slug.test(config.owner) || !slug.test(config.repo))
      throw new Error('请配置有效的 GITCODE_OWNER 和 GITCODE_REPO');
    const path = `${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repo)}`;
    this.base = `https://api.gitcode.com/api/v5/repos/${path}/releases`;
    this.page = `https://gitcode.com/${path}/releases`;
  }
  private async api(path: string, init: RequestInit = {}) {
    const url = new URL(this.base + path);
    if (this.config.token)
      url.searchParams.set('access_token', this.config.token);
    try {
      const response = await this.request(url, {
        ...init,
        redirect: 'error',
        cache: 'no-store',
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) throw new GitCodeApiError(response.status);
      return await response.json();
    } catch (error) {
      if (error instanceof GitCodeApiError) throw error;
      throw new Error('GitCode 网络请求或响应失败');
    }
  }
  async getRelease(tag: string) {
    return releaseSchema.parse(
      await this.api(`/tags/${encodeURIComponent(tag)}`),
    );
  }
  async latestAndroid() {
    const candidates: {
      release: GitCodeRelease;
      asset: GitCodeAsset;
      version: string;
    }[] = [];
    for (let page = 1; page <= 20; page++) {
      const releases = z
        .array(releaseSchema)
        .parse(await this.api(`?page=${page}&per_page=100`));
      for (const release of releases) {
        const version = /^v?(\d+\.\d+\.\d+)$/.exec(release.tag_name)?.[1];
        if (
          !version ||
          release.prerelease ||
          release.draft ||
          release.release_status === 'pre'
        )
          continue;
        // 只选取与本 Release 版本一致的倾盖如故 APK，避免误选源码包或其他产品。
        const asset = release.assets.find(
          (item) => item.name === `qinggai-${version}-release.apk`,
        );
        if (asset) candidates.push({ release, asset, version });
      }
      if (releases.length < 100) {
        candidates.sort((a, b) => {
          const av = a.version.split('.').map(BigInt);
          const bv = b.version.split('.').map(BigInt);
          for (let i = 0; i < 3; i++) {
            if (av[i] !== bv[i]) return av[i]! > bv[i]! ? -1 : 1;
          }
          return 0;
        });
        return candidates[0];
      }
    }
    throw new Error('GitCode Release 数量超过查询上限');
  }
  safeUrl(value?: string) {
    if (!value) return;
    try {
      const url = new URL(value);
      if (
        url.protocol !== 'https:' ||
        url.username ||
        url.password ||
        [...url.searchParams.keys()].some(
          (key) => key.toLowerCase() === 'access_token',
        ) ||
        (this.config.token &&
          (value.includes(this.config.token) ||
            decodeURIComponent(value).includes(this.config.token)))
      )
        return;
      return url.href;
    } catch {
      return;
    }
  }
  async downloadUrl(asset: GitCodeAsset) {
    const url = this.safeUrl(asset.browser_download_url);
    if (!url) return;
    const probe = async (target: string) => {
      // 检查第一跳，不自动追踪到未经校验的地址。
      const response = await this.request(target, {
        method: 'HEAD',
        redirect: 'manual',
        cache: 'no-store',
        signal: AbortSignal.timeout(10_000),
      });
      return (
        response.ok &&
        !response.headers.get('content-type')?.includes('text/html')
      );
    };
    try {
      if (await probe(url)) return url;
      // 部分 GitCode 附件 HEAD 返回 401，GET 则跳转公开 CDN；不下载正文。
      const response = await this.request(url, {
        redirect: 'manual',
        cache: 'no-store',
        signal: AbortSignal.timeout(10_000),
      });
      try {
        if ([301, 302, 303, 307, 308].includes(response.status)) {
          const location = response.headers.get('location');
          const direct = location && this.safeUrl(new URL(location, url).href);
          if (direct && (await probe(direct))) return direct;
        }
      } finally {
        await response.body?.cancel();
      }
    } catch {
      /* 调用方回退到 GitCode Release 页面。 */
    }
  }
  async createOrGetRelease(version: string) {
    if (!this.config.token) throw new Error('发布需要 GITCODE_TOKEN');
    if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error('发布版本号无效');
    const tag = `v${version}`;
    try {
      return await this.getRelease(tag);
    } catch (error) {
      if (!(error instanceof GitCodeApiError) || error.status !== 404)
        throw error;
    }
    return releaseSchema.parse(
      await this.api('', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tag_name: tag,
          name: `倾盖如故 ${tag}`,
          release_status: 'latest',
          body: `从初见，到如故。\n\nAndroid 安装包：qinggai-${version}-release.apk\n附带 SHA256 校验文件。\n官网永久下载入口：/download/android`,
        }),
      }),
    );
  }
  async upload(tag: string, name: string, path: string) {
    if (!this.config.token) throw new Error('发布需要 GITCODE_TOKEN');
    const signed = z
      .object({ url: z.string(), headers: z.record(z.string(), z.string()) })
      .parse(
        await this.api(
          `/${encodeURIComponent(tag)}/upload_url?file_name=${encodeURIComponent(name)}`,
        ),
      );
    if (!this.safeUrl(signed.url)) throw new Error('GitCode 上传地址无效');
    const { openAsBlob } = await import('node:fs');
    try {
      const response = await this.request(signed.url, {
        method: 'PUT',
        headers: signed.headers,
        body: await openAsBlob(path),
        redirect: 'error',
        signal: AbortSignal.timeout(15 * 60_000),
      });
      if (!response.ok) throw new Error();
    } catch {
      throw new Error('GitCode 上传失败，本地安装包已保留');
    }
  }
}
export function gitCodeFromEnv(
  env: NodeJS.ProcessEnv = process.env,
  request: typeof fetch = fetch,
) {
  return new GitCodeReleases(
    {
      owner: env.GITCODE_OWNER || '',
      repo: env.GITCODE_REPO || '',
      token: env.GITCODE_TOKEN,
    },
    request,
  );
}
