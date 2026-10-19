import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Hono } from 'hono';
import { createWebsiteApp } from './website';

const root = mkdtempSync(join(tmpdir(), 'qinggai-website-'));
const apk = new Uint8Array([80, 75, 3, 4, 0, 255, 32, 128]);
const app = new Hono();
app.get('/health', (c) => c.json({ status: 'ok' }));
app.route(
  '/',
  createWebsiteApp(root, {
    download: async () =>
      new Response(null, {
        status: 302,
        headers: {
          Location:
            'https://gitcode.com/example/qinggai/releases/download/v0.1.1/qinggai-0.1.1-release.apk',
          'Cache-Control': 'no-store',
        },
      }),
    metadata: async () => Response.json({ version: '0.1.1', bytes: 50226169 }),
  }),
);
beforeAll(() => {
  mkdirSync(join(root, 'downloads'));
  mkdirSync(join(root, 'assets'));
  writeFileSync(join(root, 'index.html'), '<h1>倾盖如故</h1>');
  writeFileSync(join(root, 'downloads/qinggai-android.apk'), apk);
  writeFileSync(join(root, 'assets/logo.webp'), 'RIFF');
  writeFileSync(join(root, 'faq.html'), '<h1>组织者录音与参与者扫码问答</h1>');
  writeFileSync(join(root, 'faq.md'), '# 产品问答');
  writeFileSync(join(root, 'robots.txt'), 'User-agent: *\nAllow: /');
  writeFileSync(
    join(root, 'sitemap.xml'),
    '<?xml version="1.0"?><urlset></urlset>',
  );
});
afterAll(() => rmSync(root, { recursive: true, force: true }));
describe('官网与 GitCode 下载', () => {
  it('首页可用，健康检查仍返回 JSON，未知路径不回退到首页', async () => {
    expect(await (await app.request('/')).text()).toContain('倾盖如故');
    expect(await (await app.request('/health')).json()).toEqual({
      status: 'ok',
    });
    expect((await app.request('/sessions/not-an-api')).status).toBe(404);
    expect((await app.request('/.env')).status).toBe(404);
  });
  it('Android 下载跳转 GitCode，即使磁盘上遗留 APK 也不提供本地下载', async () => {
    const response = await app.request('/download/android');
    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toContain('https://gitcode.com/');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.text()).toBe('');
    expect((await app.request('/downloads/qinggai-android.apk')).status).toBe(
      404,
    );
  });
  it('版本信息由 GitCode 下载服务提供', async () => {
    expect(await (await app.request('/downloads/release.json')).json()).toEqual(
      { version: '0.1.1', bytes: 50226169 },
    );
  });
  it('问答与抓取入口可匿名读取，并提供对应内容类型', async () => {
    expect(await (await app.request('/faq')).text()).toContain('组织者录音');
    expect(
      (await app.request('/faq.md')).headers.get('content-type'),
    ).toContain('text/markdown');
    expect(
      (await app.request('/robots.txt')).headers.get('content-type'),
    ).toContain('text/plain');
    expect(
      (await app.request('/sitemap.xml')).headers.get('content-type'),
    ).toContain('xml');
  });
  it('Logo 使用 WebP MIME 类型', async () => {
    expect(
      (await app.request('/assets/logo.webp')).headers.get('content-type'),
    ).toContain('image/webp');
  });
});
