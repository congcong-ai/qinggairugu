# 倾盖如故

把每一次见面留下来。

Android 负责本地录音与私人 AI 整理，微信小程序负责本场参与者与已发布回顾，轻量 API 只保存共享数据。第一版仅支持阿里云百炼 BYOK，不含支付。

## 本地环境

- Node.js 22.13+（本机 24.16.0）、pnpm 11.17.0、Java 21。
- Expo SDK 58，React Native 0.88，React 19.3；按 Expo 官方版本矩阵锁定。
- Taro 4.3，React 18（与 Mobile 各自管理 React 版本）。
- Android SDK 本机位置：`/opt/homebrew/share/android-commandlinetools`。
- Android 构建已安装所需平台、Build Tools 37 与 NDK 27.1；尚无连接设备。
- 微信开发者工具：`/Applications/wechatwebdevtools.app`。
- PostgreSQL 16 已安装；不使用 Docker。

```bash
pnpm install
pnpm dev
pnpm dev:mobile
pnpm dev:miniapp
pnpm dev:api
pnpm build
pnpm lint
pnpm typecheck
pnpm test
```

`dev` 脚本会先终止对应端口的监听进程，再启动服务：Mobile 8082、API 9001；小程序 watch 不启动 HTTP 服务，预留 10086。请勿在这些端口运行无关服务。

```bash
export ANDROID_HOME=/opt/homebrew/share/android-commandlinetools
export PATH="$ANDROID_HOME/platform-tools:$PATH"
pnpm --filter @pengtou/mobile android:prebuild
pnpm android
```

开发构建使用 Custom Dev Client，不依赖 Expo Go。`pnpm build` 中 Mobile 的产物为 Android JS bundle，不能等同于 APK 或真机验收。

微信开发者工具导入 `apps/miniapp`；当前游客 AppID 已被本机工具拒绝，需要在 `apps/miniapp/project.config.json` 填写自己的 AppID。AppSecret 只填后端 `.env`。真机请求 API 时使用开发电脑的局域网 IP，不使用 localhost。

## 数据库与服务配置

```bash
cp .env.example .env
createdb pengtou
pnpm --filter @pengtou/database migrate
pnpm dev:api
```

如果数据库已存在，不重复执行 `createdb`。配置 `DATABASE_URL` 后执行增量 migration；不修改已执行的历史 SQL。服务端只持久化共享内容。

Mobile 的 `EXPO_PUBLIC_API_URL` 放在 `apps/mobile/.env`（已忽略）；正式版必须 HTTPS。小程序构建前设置 `TARO_APP_API_URL`。后端根 `.env` 不会自动成为 Mobile 的环境文件。

只在本地调试时，同时设置后端 `ALLOW_DEV_AUTH=true` 和小程序 `TARO_APP_DEV_AUTH=true` 后运行开发命令，可使用明确的开发身份；生产环境禁用。真实用户路径使用 `wx.login`。

手机使用时，百炼 Key 在「我的 → AI 服务」输入。若要先从本机验证，在根 `.env` 填写 `DASHSCOPE_API_KEY` 后运行 `pnpm ai:test`，仅请求百炼的连接、短文本向量和短文本摘要，会产生少量账户调用用量；不会测试音频 ASR，也不会把 Key 发送到倾盖如故后端或打进 App。当前采用北京地域，模型配置集中在 `packages/ai/src/config.ts`。不把 Key 放到后端环境变量。

## 构建安装包

```bash
pnpm --filter @pengtou/mobile android:prebuild
cd apps/mobile/android
./gradlew :app:assembleDebug :app:assembleRelease :app:bundleRelease -PreactNativeArchitectures=arm64-v8a
```

先配置 `ANDROID_HOME`、Java 21；如需代理，为 Gradle 命令添加本机代理参数。debug APK 使用开发签名并连接 Metro；release APK/AAB 缺少私有签名时保持未签名，签名说明见 [Android 上架清单](docs/APP_RELEASE_CHECKLIST.md)。发布前配置 HTTPS 地址并重新构建，未签名包不能直接安装。

## 验证

```bash
pnpm lint
pnpm typecheck
pnpm build
TEST_DATABASE_URL=postgres://localhost:5432/postgres pnpm test
```

集成测试会创建和删除独立随机测试数据库，需要该实例的建库权限；不操作业务数据库。真机验收顺序见 TASK.md 和 [验证记录](docs/DEVELOPMENT.md)。

## 目录

`apps/mobile`、`apps/miniapp`、`apps/api` 是三个应用；`packages` 提供 contracts、database、ai、shared、design-tokens、config。

## 验收进度

实际命令与结果持续记录在 [开发验证记录](docs/DEVELOPMENT.md)。缺少的配置见 [需要补齐的配置与设备](docs/NEED_FROM_OWNER.md)。未完成真机、微信和百炼真实链路前，不视为 MVP 完成。

## 依赖依据

- [Expo SDK](https://docs.expo.dev/versions/latest/)
- [Expo Audio 后台录音](https://docs.expo.dev/versions/latest/sdk/audio/)
- [Expo SQLite](https://docs.expo.dev/versions/latest/sdk/sqlite/)
- [Taro 安装及使用](https://docs.taro.zone/docs/GETTING-STARTED)
- [Hono Node.js](https://hono.dev/docs/getting-started/nodejs)
- [Drizzle PostgreSQL](https://orm.drizzle.team/docs/get-started/postgresql-new)
- [Turborepo 仓库结构](https://turborepo.dev/docs/crafting-your-repository/structuring-a-repository)

引入版本通过 npm registry 验证，最终版本记录在 `pnpm-lock.yaml`。界面采用 React Native 原生组件和共享语义 tokens，当前不引入额外 UI 框架以减少新 SDK 原生兼容面。

## 临时网络代理

本机 ClashX HTTP 代理为 `http://127.0.0.1:7890`。需要时仅为命令设置：

```bash
HTTP_PROXY=http://127.0.0.1:7890 HTTPS_PROXY=http://127.0.0.1:7890 NO_PROXY=localhost,127.0.0.1 pnpm install
```

不修改系统或 Git 全局代理。其他开发者需按自己的本地代理端口配置。

华为鸿蒙 4.2 和 Android 真机的连接、独立安装与测试流程见 [真机测试指南](docs/ANDROID_DEVICE_TESTING.md)。微信配置申请中仍可测试录音和 BYOK。

## China 服务器部署

仅部署 Hono API 到 `qgrg.bebackpacker.com`，使用原生 Node.js、PM2、Nginx 与 PostgreSQL。China API 已于 2026-10-19 完成首次部署，公网 API/数据库健康检查及 TLS 验证通过；本地构建、审计、授权边界与安装发布步骤见 [生产部署说明](docs/PRODUCTION_DEPLOYMENT.md)。可运行 `pnpm server:ports` 核查，或 `pnpm server:build /tmp/qinggai-release.tar.gz` 生成本地发布包。

### 品牌官网

`pnpm dev:web` 构建并在 <http://localhost:3000> 预览官网，启动前自动释放 3000 端口。源码在 `apps/web`，无需新增前端依赖。修改页面后运行 `pnpm build:web` 并刷新浏览器。

官网构建不依赖 APK，不将安装包打入网站或服务器发布包。Logo 源于 `assets/logo/logo.png`，网页使用 `apps/web/assets/logo.webp`。

生产 API 同时提供首页、`/download/android` 直达下载、`/privacy` 和 `/terms`；现有 `server:build` 包含官网，沿用同一域名和部署流程。iOS 按钮提示「正在申请 App Store 上架中」，参与者仍可通过主办方活动码加入小程序。

### GitCode Android 下载与发布

下载沿用 CreatorLens 的 GitCode Release 方案：官网 `/download/android` 查询最新含 Android 附件的正式 Release，再以 302 跳转公开附件/CDN，安装包流量不经过网站服务器。API 或附件检查失败时回退到 GitCode 发布页；仓库未配置时返回 503。官网版本信息动态读取 `/downloads/release.json`，不写死旧版本。

在根目录 `.env` 和生产服务器 `/var/www/qinggai/shared/.env` 填写 `GITCODE_OWNER`、`GITCODE_REPO`。公开仓库一般可以匿名查询；需要鉴权时仅在服务端配置 `GITCODE_TOKEN`，该 Token 不进入页面、App、下载跳转或附件请求。请使用独立的公开安装包仓库，无需公开产品源代码。

本机发布流程：先运行现有 Android 构建命令生成 `artifacts/android/release.json` 和正式 APK，再运行 `pnpm android:publish`。发布需要本机根目录 `.env` 中的 GitCode Token；脚本创建或复用 `v版本号` Release，上传 `qinggai-版本号-release.apk` 与 `.sha256`，下载远端附件核验 SHA256。本地文件始终保留；已存在但内容不同的同名附件不会覆盖，应提高版本号。发布新 APK 后官网自动选择新版本，无需重新部署官网。
