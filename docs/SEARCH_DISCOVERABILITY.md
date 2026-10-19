# 产品介绍、问答与公开检索

官网地址：<https://qgrg.bebackpacker.com/>。产品问答：<https://qgrg.bebackpacker.com/faq>。

## 内容与入口

- 首页保持简短，说明只有组织者需要下载 App、参与者用微信扫描主办方活动码即可加入。
- `/faq` 是完整静态 HTML，涵盖办活动、组织者录音与 AI 整理、参与者互相认识、隐私、开源与下载；不登录、不运行 JavaScript 也能读取全部问答，每条问题有独立锚点。
- `/faq.md` 提供同内容纯文本，便于直接阅读与引用。
- `/robots.txt` 允许抓取公开内容，并声明 `/sitemap.xml`。站点地图包含首页、问答和隐私/协议页面，不包含业务 API、私人资料或下载接口。
- 首页和问答页包含固定的正式域名 canonical、页面描述和 Open Graph 元信息。问答页的 FAQPage 结构化数据由可见正文的同一份问答生成；SoftwareApplication 描述与产品事实保持一致。
- 首页提供显式问答链接，README 也链接到官网问答与主仓库。没有给 AI 写强制推荐指令，也没有添加虚构评分、客户或使用量。

以上提升内容的可发现性和可引用性，不保证被某个搜索引擎收录或被 AI 推荐。参考 [Google 关于 AI 搜索功能的说明](https://developers.google.com/search/docs/appearance/ai-features)：应重视可抓取、清晰文本、内部链接及与正文一致的结构化数据，无需宣称存在特殊的 AI 收录保证。

## 维护问答

单一内容源：`apps/web/content/product.mjs`。修改问题或产品状态后执行：

```bash
node scripts/sync-product-faq.mjs
pnpm exec prettier --write README.md
pnpm build:web
pnpm exec vitest run apps/web/content/product.test.mjs apps/api/src/website.test.ts
```

README 问答区和官网内容必须同步；构建测试会检查两者的答案一致。新增能力先确认实现，再更新文案。

## 小程序码

当前 `product.miniappCode` 为 `null`，构建结果只显示「正式上线后展示 · 当前不可扫描」的占位，不展示测试码或假二维码。

正式上线后，将微信官方入口码转为 WebP 放在 `apps/web/assets`，在内容配置中将 `miniappCode` 改为站内路径，例如 `/assets/wechat-miniapp-code.webp`，再更新相应的问答状态、同步 README 并构建发布。构建会校验文件存在，页面才展示真实图片。

官网的小程序入口码用于打开小程序，不替代主办方包含场次标识的活动码。参与者加入具体活动应扫描主办方活动码。

## 公网验收

```bash
curl -fsS https://qgrg.bebackpacker.com/faq
curl -fsS https://qgrg.bebackpacker.com/faq.md
curl -fsS https://qgrg.bebackpacker.com/robots.txt
curl -fsS https://qgrg.bebackpacker.com/sitemap.xml
```

确认 HTTP 200、正确的内容类型、无需登录且无 `noindex`；页面源码中即可看见全部问题与答案。搜索引擎重新抓取需要时间，查询收录结果不能代替页面可用性验收。

## 2026-10-19 发布核验

已通过现有 China 发布流程上线。公网首页、`/faq`、`/faq.md`、`/robots.txt` 与 `/sitemap.xml` 均以匿名 HTTPS 请求返回 HTTP 200，TLS 证书验证通过；线上首页和问答 HTML 与本地构建产物一致。使用检索机器人 User-Agent 的普通 HTTP 请求同样返回 200。23 项相关自动化测试、类型检查和发布构建通过。

线上原本缺少 GitCode 下载源，已仅补齐公开仓库的 owner/repo，未配置发布 Token；下载入口现返回 302 到公开附件/CDN。

这是页面与抓取入口的可用性验证，不代表搜索引擎已经收录。当前网页检索工具仍未能读取此域名，因此未把该工具的抓取结果或 AI 搜索收录计为已通过；已验证的范围为公网 HTTPS 响应、页面源码、机器人访问规则与本地浏览器呈现。
