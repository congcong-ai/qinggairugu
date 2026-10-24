import { afterAll, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildProductPages,
  escapeHtml,
  miniappEntry,
} from '../../../scripts/build-product-pages.mjs';
import { product, questions } from './product.mjs';
const output = mkdtempSync(resolve(tmpdir(), 'qinggai-public-content-'));
mkdirSync(resolve(output, 'assets'));
buildProductPages(output);
afterAll(() => rmSync(output, { recursive: true, force: true }));
describe('公网产品问答与抓取产物', () => {
  it('不执行 JavaScript 也能读取每组答案，FAQ 结构化数据与可见正文一致', () => {
    const html = readFileSync(resolve(output, 'faq.html'), 'utf8');
    const schemas = [
      ...html.matchAll(
        /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g,
      ),
    ].map((m) => JSON.parse(m[1]));
    const schema = schemas.find((s) => s['@type'] === 'FAQPage');
    expect(schema.mainEntity).toHaveLength(questions.length);
    for (const [i, q] of questions.entries()) {
      expect(html).toContain(`<article class="faq-answer" id="${q.id}">`);
      expect(html).toContain(`<p>${escapeHtml(q.answer)}</p>`);
      expect(schema.mainEntity[i].acceptedAnswer.text).toBe(q.answer);
    }
    expect(html).toContain(`rel="canonical" href="${product.origin}/faq"`);
    expect(html).not.toContain('noindex');
  });
  it('robots 与 sitemap 指向真实公开内容，不把 API 与下载入口放进 sitemap', () => {
    const robots = readFileSync(resolve(output, 'robots.txt'), 'utf8');
    const sitemap = readFileSync(resolve(output, 'sitemap.xml'), 'utf8');
    expect(robots).toContain('Allow: /');
    expect(robots).toContain(`Sitemap: ${product.origin}/sitemap.xml`);
    expect(sitemap).toContain(`<loc>${product.origin}/faq</loc>`);
    for (const path of ['/auth/', '/sessions', '/download/android'])
      expect(sitemap).not.toContain(path);
  });
  it('README、纯文本问答和网页使用同一份答案，保留准确隐私与角色边界', () => {
    const markdown = readFileSync(resolve(output, 'faq.md'), 'utf8');
    const readme = readFileSync(
      fileURLToPath(new URL('../../../README.md', import.meta.url)),
      'utf8',
    );
    for (const q of questions) {
      expect(markdown).toContain(q.answer);
      expect(readme).toContain(q.answer);
    }
    expect(markdown).toContain('录音和图片只保存在 App 所在手机本地');
    expect(markdown).toContain('手机会把录音临时发送阿里云百炼处理');
  });
  it('小程序未上线时只有明确标注的占位，不生成可误扫的二维码', () => {
    const entry = miniappEntry();
    expect(entry).toContain('当前不可扫描');
    expect(entry).not.toContain('<img');
    expect(entry).not.toContain('<canvas');
  });
});
