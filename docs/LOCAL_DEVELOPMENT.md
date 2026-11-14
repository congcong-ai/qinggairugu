# 倾盖如故本地开发与部署

[返回产品介绍与常见问答](../README.md)

以下命令在仓库根目录执行；本机路径示例需按自己的环境调整。

## 本地环境

- Node.js 22.13+（本机 24.16.0）、pnpm 11.17.0、Java 21。
- Expo SDK 58，React Native 0.88，React 19.3；按 Expo 官方版本矩阵锁定。
- Taro 4.3，React 18（与 Mobile 各自管理 React 版本）。
- Android SDK 本机位置：`~/Library/Android/sdk`。
- Android 构建需要相应平台、Build Tools 37 与 NDK 27.1。
- 微信开发者工具：`/Applications/wechatwebdevtools.app`。
- PostgreSQL 16 已安装；不使用 Docker。

```bash
pnpm install
# 完成下方 .env 和数据库初始化后，从根目录启动完整开发环境：
pnpm dev
```

`pnpm dev` 是统一开发入口：检查并启动 Android 模拟器（已开机时会复用），确认模拟器装有当前源码对应的 Expo 开发版，然后构建官网，并在同一个终端启动官网预览、API、微信小程序监听编译和 Expo App 调试。App 会自动打开并连接本机 Metro（8082），页面源码改动即时刷新。原生依赖、Android 配置或版本号变化时才会自动重建并安装开发版；纯 JS/TS 改动不会重装 App。打开 `http://localhost:3000` 查看官网，API 地址为 `http://localhost:9001`，健康检查为 `http://localhost:9001/health`；小程序改动会自动编译到 `apps/miniapp/dist`，Expo 使用 8082 端口。官网源码修改后也会自动重建，刷新页面即可查看。

自动启动模拟器需要本机已安装 Android SDK 的 Emulator 组件并至少创建一个 AVD；Android Studio 不是必需项。脚本优先选择与主机架构对应的 `qinggai-review-api36` 或 `qinggai-review-arm64-api36`，没有时使用第一个可用 AVD，也可通过 `ANDROID_AVD_NAME` 指定。`pnpm dev` 首次会自动构建并安装 Expo 开发版；以后只在原生配置变化时重新安装，日常 JS/TS 开发直接加载 Metro 当前源码。更新通过 Android 原有签名执行，不会卸载 App 或清除本机数据；若 Android 拒绝签名更新，启动会停止并保留已安装版本。

需要单独启动某个服务时，再使用：

```bash
pnpm dev:mobile
pnpm dev:miniapp
pnpm dev:api
pnpm dev:web
```

其它常用命令：

```bash
pnpm build
pnpm lint
pnpm typecheck
pnpm test
```

统一入口会先构建官网；API、官网预览、Mobile 各自启动脚本会检查并清理对应端口上的旧监听，再启动服务：官网预览 3000、API 9001、Mobile 8082。小程序 watch 不启动 HTTP 服务，预留 10086。请勿在这些端口运行无关服务。

```bash
export ANDROID_HOME="$HOME/Library/Android/sdk"
export PATH="$ANDROID_HOME/platform-tools:$PATH"
pnpm --filter @qinggairugu/mobile android:prebuild
pnpm android
```

开发构建使用 Custom Dev Client，不依赖 Expo Go。`pnpm build` 中 Mobile 的产物为 Android JS bundle，不能等同于 APK 或真机验收。仅修改 JS/TS 页面时，模拟器中的 Dev Client 连接 8082 端口即可加载当前源码；若模拟器安装的是普通发布版或旧安装包，需要先保存本机录音等数据，再运行 `pnpm android` 安装开发版。

微信开发者工具导入 `apps/miniapp`，使用项目自己的 AppID；不能依赖游客 AppID 验证真实微信登录。AppSecret 只填后端 `.env`。小程序按运行平台自动选 API：开发者工具模拟器访问本机 `http://127.0.0.1:9001` 并使用本地开发身份；真实微信客户端（包括扫码预览、开发版、体验版和正式版）访问 `https://qgrg.bebackpacker.com` 并走 `wx.login`。因此同一份编译产物可以直接在开发者工具点上传，不会把手机请求发到本机。

## 数据库与服务配置

```bash
cp .env.example .env
createdb qinggairugu
pnpm --filter @qinggairugu/database migrate
pnpm dev
```

如果数据库已存在，不重复执行 `createdb`。配置 `DATABASE_URL` 后执行增量 migration；不修改已执行的历史 SQL。服务端只持久化共享内容。

Mobile 的 `EXPO_PUBLIC_API_URL` 放在 `apps/mobile/.env`（已忽略）；正式版必须 HTTPS。小程序 API 地址由运行平台自动选择，不需要上传前改环境变量或重新切生产配置。后端根 `.env` 不会自动成为 Mobile 的环境文件。

只在本地调试时，将后端 `ALLOW_DEV_AUTH=true` 后运行 API，可供开发者工具模拟器使用开发身份；生产部署强制关闭该开关。真机扫码及所有线上版本使用 `wx.login`。

手机使用时，百炼 Key 在「我的 → AI 服务」输入。若要先从本机验证，在根 `.env` 填写 `DASHSCOPE_API_KEY` 后运行 `pnpm ai:test`，仅请求百炼的连接、短文本向量和短文本摘要，会产生少量账户调用用量；不会测试音频 ASR，也不会把 Key 发送到倾盖如故后端或打进 App。当前采用北京地域，模型配置集中在 `packages/ai/src/config.ts`。不把 Key 放到后端环境变量。

## 构建安装包

```bash
pnpm --filter @qinggairugu/mobile android:prebuild
cd apps/mobile/android
./gradlew :app:assembleDebug :app:assembleRelease :app:bundleRelease -PreactNativeArchitectures=arm64-v8a
```

先配置 `ANDROID_HOME`、Java 21；如需代理，为 Gradle 命令添加本机代理参数。debug APK 使用开发签名并连接 Metro；release APK/AAB 缺少私有签名时保持未签名，签名说明见 [Android 上架清单](APP_RELEASE_CHECKLIST.md)。发布前配置 HTTPS 地址并重新构建，未签名包不能直接安装。

## 验证

```bash
pnpm lint
pnpm typecheck
pnpm build
TEST_DATABASE_URL=postgres://localhost:5432/postgres pnpm test
```

集成测试会创建和删除独立随机测试数据库，需要该实例的建库权限；不操作业务数据库。真机验收顺序见 [TASK.md](../TASK.md) 和 [验证记录](DEVELOPMENT.md)。

## 目录

`apps/mobile`、`apps/miniapp`、`apps/api` 是三个应用；`packages` 提供 contracts、database、ai、shared、design-tokens、config。

## 验收进度

实际命令与结果持续记录在 [开发验证记录](DEVELOPMENT.md)。缺少的配置见 [需要补齐的配置与设备](NEED_FROM_OWNER.md)。未完成真机、微信和百炼真实链路前，不视为 MVP 完成。

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

华为鸿蒙 4.2 和 Android 真机的连接、独立安装与测试流程见 [真机测试指南](ANDROID_DEVICE_TESTING.md)。微信配置申请中仍可测试录音和 BYOK。

## China 服务器部署

仅部署 Hono API 到 `qgrg.bebackpacker.com`，使用原生 Node.js、PM2、Nginx 与 PostgreSQL。China API 已于 2026-10-19 完成首次部署，公网 API/数据库健康检查及 TLS 验证通过；本地构建、审计、授权边界与安装发布步骤见 [生产部署说明](PRODUCTION_DEPLOYMENT.md)。可运行 `pnpm server:ports` 核查，或 `pnpm server:build /tmp/qinggai-release.tar.gz` 生成本地发布包。

### 品牌官网

`pnpm dev:web` 构建并在 <http://localhost:3000> 预览官网，启动前自动释放 3000 端口。源码在 `apps/web`，无需新增前端依赖。修改页面后运行 `pnpm build:web` 并刷新浏览器。

官网构建不依赖 APK，不将安装包打入网站或服务器发布包。Logo 源于 `assets/logo/logo.png`，网页使用 `apps/web/assets/logo.webp`。

生产 API 同时提供首页、`/download/android` 直达下载、`/privacy` 和 `/terms`；现有 `server:build` 包含官网，沿用同一域名和部署流程。iOS 按钮提示「正在申请 App Store 上架中」，参与者仍可通过主办方活动码加入小程序。

### GitCode Android 下载与发布

下载沿用 CreatorLens 的 GitCode Release 方案：官网 `/download/android` 查询最新含 Android 附件的正式 Release，再以 302 跳转公开附件/CDN，安装包流量不经过网站服务器。API 或附件检查失败时回退到 GitCode 发布页；仓库未配置时返回 503。官网版本信息动态读取 `/downloads/release.json`，不写死旧版本。

在根目录 `.env` 和生产服务器 `/var/www/qinggai/shared/.env` 填写 `GITCODE_OWNER`、`GITCODE_REPO`。公开仓库一般可以匿名查询；需要鉴权时仅在服务端配置 `GITCODE_TOKEN`，该 Token 不进入页面、App、下载跳转或附件请求。本项目使用 GitHub 公开源码主仓库，GitCode 为独立的公开安装包从属仓库，不同步产品源码。

本机发布流程：先运行现有 Android 构建命令生成 `artifacts/android/release.json` 和正式 APK，再运行 `pnpm android:publish`。发布需要本机根目录 `.env` 中的 GitCode Token；脚本创建或复用 `v版本号` Release，上传 `qinggai-版本号-release.apk` 与 `.sha256`，下载远端附件核验 SHA256。本地文件始终保留；已存在但内容不同的同名附件不会覆盖，应提高版本号。发布新 APK 后官网自动选择新版本，无需重新部署官网。
