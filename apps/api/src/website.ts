import { createAndroidDownloadService } from './releases/download';
import { Hono } from 'hono';
import { serveStatic } from '@hono/node-server/serve-static';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** 官网和 API 共用域名；只暴露明确的公开文件，避免吞掉未知 API 路径。 */
export function createWebsiteApp(
  root = fileURLToPath(new URL('../../web/dist/', import.meta.url)),
  downloads = createAndroidDownloadService(),
) {
  const website = new Hono();
  website.use('*', async (c, next) => {
    c.header('X-Content-Type-Options', 'nosniff');
    await next();
  });
  for (const [route, file] of [
    ['/', 'index.html'],
    ['/privacy', 'privacy.html'],
    ['/terms', 'terms.html'],
    ['/style.css', 'style.css'],
    ['/main.js', 'main.js'],
    ['/assets/logo.webp', 'assets/logo.webp'],
  ] as const) {
    website.get(route, serveStatic({ path: resolve(root, file) }));
  }
  website.get('/download/android', () => downloads.download());
  website.get('/downloads/release.json', () => downloads.metadata());
  return website;
}
