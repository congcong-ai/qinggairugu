import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = resolve(root, 'apps/web');
const output = resolve(root, 'apps/web/dist');
// 官网构建不读取或打包 APK；安装包统一通过 GitCode Release 下载。
rmSync(output, { recursive: true, force: true });
mkdirSync(resolve(output, 'assets'), { recursive: true });
for (const file of ['index.html', 'style.css', 'main.js', 'assets/logo.webp'])
  cpSync(resolve(source, file), resolve(output, file));
const escape = (value) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
for (const [slug, filename, title] of [
  ['privacy', 'PRIVACY_POLICY.md', '隐私政策'],
  ['terms', 'TERMS_OF_SERVICE.md', '用户协议'],
]) {
  const path = resolve(root, 'docs', filename);
  if (!existsSync(path)) throw new Error(`缺少 ${title} 文档`);
  writeFileSync(
    resolve(output, `${slug}.html`),
    `<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} · 倾盖如故</title><link rel="icon" type="image/webp" href="/assets/logo.webp"><style>body{max-width:760px;margin:48px auto;padding:0 24px;background:#f5f3eb;color:#242820;font-family:system-ui,sans-serif}a{color:#42552e}pre{white-space:pre-wrap;overflow-wrap:anywhere;font-family:inherit;font-size:15px;line-height:1.9}</style></head><body><a href="/">← 返回倾盖如故</a><main><pre>${escape(readFileSync(path, 'utf8'))}</pre></main></body></html>`,
  );
}
console.log(`官网已构建：${output}（安装包由 GitCode Release 提供）`);
