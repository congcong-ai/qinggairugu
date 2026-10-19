import { gitCodeFromEnv, type GitCodeReleases } from './gitcode';

export function createAndroidDownloadService(
  provider: () => GitCodeReleases = gitCodeFromEnv,
) {
  // 并发请求共享正在进行的查询；不持久缓存带有效期的附件地址。
  let pending: ReturnType<GitCodeReleases['latestAndroid']> | undefined;
  function latest(client: GitCodeReleases) {
    if (!pending) {
      const query = client.latestAndroid();
      pending = query;
      void query
        .finally(() => {
          if (pending === query) pending = undefined;
        })
        .catch(() => {});
    }
    return pending;
  }
  const unavailable = () =>
    new Response('安装包正在准备，请稍后重试。', {
      status: 503,
      headers: { 'Cache-Control': 'no-store', 'Retry-After': '120' },
    });
  return {
    async download() {
      let target: string | undefined;
      try {
        const client = provider();
        target = client.page;
        const result = await latest(client);
        if (result) {
          target = `${client.page}/${encodeURIComponent(result.release.tag_name)}`;
          target = (await client.downloadUrl(result.asset)) || target;
        }
      } catch {
        /* 配置缺失返回 503，GitCode 故障回退到公开发布页。 */
      }
      return target
        ? new Response(null, {
            status: 302,
            headers: { Location: target, 'Cache-Control': 'no-store' },
          })
        : unavailable();
    },
    async metadata() {
      try {
        const result = await latest(provider());
        if (result)
          return Response.json(
            { version: result.version, bytes: result.asset.size ?? null },
            {
              headers: { 'Cache-Control': 'no-store' },
            },
          );
      } catch {
        /* 不向客户端输出 Token、内部错误或 API URL。 */
      }
      return unavailable();
    },
  };
}
