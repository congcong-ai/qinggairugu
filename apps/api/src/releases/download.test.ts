import { describe, expect, it, vi } from 'vitest';
import { createAndroidDownloadService } from './download';
import { GitCodeReleases } from './gitcode';

const token = 'test-server-only-token';
const apkUrl =
  'https://gitcode.com/example/qinggai/releases/download/v0.1.1/qinggai-0.1.1-release.apk';
const makeRelease = (version: string, extra = {}) => ({
  tag_name: `v${version}`,
  assets: [
    {
      name: `qinggai-${version}-release.apk`,
      size: 50226169,
      browser_download_url: apkUrl,
    },
  ],
  ...extra,
});
function setup(releases: unknown[] = [makeRelease('0.1.1')]) {
  const request = vi.fn<typeof fetch>(async (input) => {
    const url = String(input);
    if (url.startsWith('https://api.gitcode.com/'))
      return Response.json(releases);
    return new Response(null, {
      headers: { 'Content-Type': 'application/vnd.android.package-archive' },
    });
  });
  const client = new GitCodeReleases(
    { owner: 'example', repo: 'qinggai', token },
    request,
  );
  return {
    request,
    client,
    service: createAndroidDownloadService(() => client),
  };
}
describe('GitCode 国内仓库下载', () => {
  it('302 跳转公开附件，网站不读取 APK 正文，Token 仅发送给 API', async () => {
    const { service, request } = setup();
    const response = await service.download();
    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe(apkUrl);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.text()).toBe('');
    expect(String(request.mock.calls[0]![0])).toContain(
      `access_token=${token}`,
    );
    expect(String(request.mock.calls[1]![0])).toBe(apkUrl);
    expect(request.mock.calls[1]![1]?.method).toBe('HEAD');
    expect(JSON.stringify(request.mock.calls[1])).not.toContain(token);
  });
  it('按语义版本排序，跳过草稿、预发布、无 APK 和附件版本不匹配的 Release', async () => {
    const { service } = setup([
      makeRelease('0.9.0'),
      makeRelease('0.10.0'),
      makeRelease('2.0.0', { draft: true }),
      makeRelease('3.0.0', { prerelease: true }),
      makeRelease('4.0.0', { release_status: 'pre' }),
      makeRelease('5.0.0', { assets: [] }),
      makeRelease('6.0.0', { assets: makeRelease('0.1.1').assets }),
      makeRelease('7.0.0-beta.1'),
    ]);
    const response = await service.metadata();
    expect(await response.json()).toEqual({
      version: '0.10.0',
      bytes: 50226169,
    });
  });
  it('每次重新查询版本，不因旧缓存下载旧版本', async () => {
    const { service, request } = setup();
    expect((await (await service.metadata()).json()).version).toBe('0.1.1');
    request.mockResolvedValueOnce(Response.json([makeRelease('0.1.2')]));
    expect((await (await service.metadata()).json()).version).toBe('0.1.2');
  });
  it('HEAD 返回 401 时，解析 GET 的公开 CDN 跳转', async () => {
    const { service, request } = setup();
    const cdn =
      'https://cdn.gitcode.com/packages/qinggai.apk?signature=temporary';
    request
      .mockResolvedValueOnce(Response.json([makeRelease('0.1.1')]))
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(
        new Response(null, { status: 302, headers: { Location: cdn } }),
      )
      .mockResolvedValueOnce(
        new Response(null, {
          headers: { 'Content-Type': 'application/octet-stream' },
        }),
      );
    expect((await service.download()).headers.get('location')).toBe(cdn);
    for (const [input, init] of request.mock.calls.slice(1)) {
      expect(String(input)).not.toContain(token);
      expect(JSON.stringify(init)).not.toContain(token);
      expect(init?.redirect).toBe('manual');
    }
  });
  it('API 故障时跳转仓库发布页，不回退到本地文件', async () => {
    const { service, request } = setup();
    request.mockRejectedValue(new Error(`internal ${token}`));
    const response = await service.download();
    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe(
      'https://gitcode.com/example/qinggai/releases',
    );
    expect(await response.text()).not.toContain(token);
  });
  it('不将登录 HTML 页面当作 APK', async () => {
    const { service, request } = setup();
    request
      .mockResolvedValueOnce(Response.json([makeRelease('0.1.1')]))
      .mockResolvedValue(
        new Response('登录', { headers: { 'Content-Type': 'text/html' } }),
      );
    expect((await service.download()).headers.get('location')).toBe(
      'https://gitcode.com/example/qinggai/releases/v0.1.1',
    );
  });
  it('无仓库配置返回 503，不泄露内部错误', async () => {
    const service = createAndroidDownloadService(() => {
      throw new Error(token);
    });
    const response = await service.download();
    expect(response.status).toBe(503);
    expect(response.headers.get('retry-after')).toBe('120');
    expect(await response.text()).not.toContain(token);
  });
  it('拒绝 HTTP、带 Token 或用户名密码的下载地址', async () => {
    const { client } = setup();
    for (const url of [
      'http://gitcode.com/a.apk',
      'https://user:pass@gitcode.com/a.apk',
      `https://gitcode.com/a.apk?ACCESS_TOKEN=${token}`,
      `https://gitcode.com/${token}/a.apk`,
    ]) {
      expect(client.safeUrl(url)).toBeUndefined();
    }
  });
  it('跨页查找 Android 包，不因最新页无 APK 丢失旧版可用包', async () => {
    const { service, request } = setup();
    request
      .mockResolvedValueOnce(
        Response.json(
          Array.from({ length: 100 }, () =>
            makeRelease('2.0.0', { assets: [] }),
          ),
        ),
      )
      .mockResolvedValueOnce(Response.json([makeRelease('0.1.1')]));
    expect((await (await service.metadata()).json()).version).toBe('0.1.1');
    expect(String(request.mock.calls[1]![0])).toContain('page=2');
  });
  it('空发布列表时提供发布页入口，版本信息返回 503', async () => {
    const { service } = setup([]);
    expect((await service.download()).headers.get('location')).toBe(
      'https://gitcode.com/example/qinggai/releases',
    );
    expect((await service.metadata()).status).toBe(503);
  });
});
