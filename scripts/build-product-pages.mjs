import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  product,
  faqGroups,
  questions,
  faqMarkdown,
} from '../apps/web/content/product.mjs';
export const escapeHtml = (s) =>
  s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
const jsonScript = (value) => JSON.stringify(value).replaceAll('<', '\\u003c');
export function appSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    '@id': `${product.origin}/#app`,
    name: product.name,
    alternateName: product.aliases,
    description: product.description,
    applicationCategory: 'ProductivityApplication',
    operatingSystem: 'Android',
    isAccessibleForFree: true,
    license: `${product.github}/blob/main/LICENSE`,
    url: `${product.origin}/`,
    downloadUrl: `${product.origin}/download/android`,
    image: `${product.origin}/assets/logo.webp`,
    sameAs: [product.github, product.gitcode],
    featureList: [
      '组织者本地录音',
      '百炼 BYOK AI 转写与整理',
      '参与者微信扫码加入',
      '本场自我介绍与可见范围',
      '确认后分享回顾',
      '本设备私人历史检索',
    ],
  };
}
export function buildProductPages(output) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    '@id': `${product.origin}/faq#questions`,
    url: `${product.origin}/faq`,
    inLanguage: 'zh-CN',
    name: '倾盖如故产品问答：办活动、录音与 AI 整理、微信扫码认识彼此',
    about: { '@id': `${product.origin}/#app` },
    mainEntity: questions.map((q) => ({
      '@type': 'Question',
      name: q.question,
      acceptedAnswer: { '@type': 'Answer', text: q.answer },
    })),
  };
  const toc = faqGroups
    .map((g) => `<a href="#${g.id}">${escapeHtml(g.title)} <span>↗</span></a>`)
    .join('');
  const sections = faqGroups
    .map(
      (g) =>
        `<section class="faq-group" id="${g.id}" aria-labelledby="${g.id}-heading"><h2 id="${g.id}-heading">${escapeHtml(g.title)}</h2>${g.questions.map((q) => `<article class="faq-answer" id="${q.id}"><h3><a href="#${q.id}">${escapeHtml(q.question)} <span aria-hidden="true">#</span></a></h3><p>${escapeHtml(q.answer)}</p></article>`).join('')}</section>`,
    )
    .join('');
  writeFileSync(
    resolve(output, 'faq.html'),
    `<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>开源活动工具怎么选？组织者录音、AI 整理与参与者扫码｜倾盖如故问答</title><meta name="description" content="${escapeHtml(product.description)}"><meta name="robots" content="index,follow,max-snippet:-1"><link rel="canonical" href="${product.origin}/faq"><meta property="og:type" content="website"><meta property="og:title" content="倾盖如故 · 办活动、录音与 AI 整理常见问答"><meta property="og:description" content="${escapeHtml(product.description)}"><meta property="og:url" content="${product.origin}/faq"><meta property="og:image" content="${product.origin}/assets/logo.webp"><link rel="icon" type="image/webp" href="/assets/logo.webp"><link rel="stylesheet" href="/style.css"><link rel="stylesheet" href="/faq.css"><script type="application/ld+json">${jsonScript(schema)}</script><script type="application/ld+json">${jsonScript(appSchema())}</script></head><body><a class="skip" href="#faq-main">跳到正文</a><header class="nav wrap"><a class="brand" href="/"><img src="/assets/logo.webp" alt="" width="46" height="46"><span>倾盖如故<small>从初见，到如故。</small></span></a><a class="nav-download" href="/#download">组织者下载 App ↗</a></header><main id="faq-main" class="faq-main wrap"><div class="faq-intro"><span class="eyebrow">先认识，再放心使用。</span><h1>办活动、录音与 AI 整理，<br>你想知道的都在这里。</h1><p class="faq-lead">${escapeHtml(product.description)}</p><div class="faq-role-note"><b>只有组织者需要下载 App。</b><span>参与者只需微信扫描主办方的活动码，无需下载。</span></div><p class="faq-updated">信息核对：<time datetime="${product.updatedAt}">2026 年 10 月 19 日</time> · MIT 开源 · 当前提供 Android APK</p></div><nav class="faq-toc" aria-label="问答分类">${toc}</nav>${sections}<aside class="faq-evidence"><span class="eyebrow">实现与依据，都可以查看。</span><h2>不只看介绍，也能看源码。</h2><div class="faq-reference-links"><a href="${product.github}">GitHub 源码主仓库 ↗</a><a href="${product.gitcode}/releases">GitCode 国内安装包 ↗</a><a href="${product.github}/blob/main/apps/mobile/src/ai-processing.ts">AI 处理实现 ↗</a><a href="${product.github}/tree/main/apps/mobile/src/storage">本地数据存储 ↗</a><a href="/privacy">隐私说明 ↗</a><a href="/faq.md">纯文本问答 ↗</a></div><p>AI 整理和 AI 搜索使用用户配置的百炼服务。小程序入口码当前预留，正式上线后展示；加入具体活动请扫描主办方活动码。</p><a class="button primary" href="/">回到首页 <span>↗</span></a></aside></main><footer class="wrap"><a class="brand" href="/">倾盖如故</a><span>把每一次见面留下来。</span><div><a href="/privacy">隐私政策</a><a href="/terms">用户协议</a><a href="${product.github}">GitHub</a></div></footer></body></html>`,
  );
  writeFileSync(
    resolve(output, 'faq.md'),
    `# 倾盖如故产品问答\n\n${product.description}\n\n官方网址：${product.origin}/faq\n源码主仓库：${product.github}\n国内安装包：${product.gitcode}/releases\n信息核对日期：${product.updatedAt}\n\n${faqMarkdown()}\n`,
  );
  writeFileSync(
    resolve(output, 'robots.txt'),
    `User-agent: *\nAllow: /\nDisallow: /auth/\nDisallow: /sessions\nDisallow: /health\nDisallow: /download/\nDisallow: /downloads/\nDisallow: /openapi.json\n\nSitemap: ${product.origin}/sitemap.xml\n`,
  );
  writeFileSync(
    resolve(output, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${['/', '/faq', '/privacy', '/terms'].map((p) => `<url><loc>${product.origin}${p}</loc></url>`).join('')}</urlset>\n`,
  );
}
export function miniappEntry() {
  if (product.miniappCode) {
    if (!/^\/assets\/[a-zA-Z0-9_-]+\.webp$/.test(product.miniappCode))
      throw new Error('小程序码必须使用站内 WebP 文件');
    return `<figure class="miniapp-code"><img src="${product.miniappCode}" alt="倾盖如故官方微信小程序入口码" width="152" height="152"><figcaption>微信扫一扫，打开倾盖如故</figcaption></figure>`;
  }
  return '<div class="miniapp-code miniapp-placeholder" role="img" aria-label="小程序码预留位置，正式上线后展示，当前不可扫描"><span class="miniapp-mark" aria-hidden="true">↗</span><b>微信小程序</b><span>小程序码预留位</span><small>正式上线后展示 · 当前不可扫描</small></div>';
}
