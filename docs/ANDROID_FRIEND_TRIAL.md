# 倾盖如故 Android 与小程序朋友试用

版本：Android `0.1.1`（versionCode 2），小程序开发版本 `0.1.1`。

## 交付物与构建

APK 输出到 `artifacts/android/qinggai-0.1.1-release.apk`，同目录包含 SHA256 文件和 `release.json`。该目录被 Git 忽略。它是内置 JS 的独立 Release 包，使用本机生成的专属正式签名，不依赖 Expo Go、Metro、USB 或开发电脑。

2026-10-19 实际产物：50,226,169 字节（约 47.9 MiB），APK SHA256 为 `7ebbfc8feaf8a356852fdc084ee064f65a2ae051d1f8c202e5998d585e62e2d6`，签名证书 SHA256 为 `5fb9f9805ba4741171034e3efe50e27b3f42e2b73b4001c00468bdbdcb4140d3`。已通过 apksigner、16 KB zipalign、名称/版本/SDK/架构及内置 JS/HTTPS 地址检查；APK 解压扫描未发现本机微信 Secret、百炼 Key 或签名密码。两种 ABI 均包含本地向量扩展。未连接设备，不将这些静态验证称为此次 APK 的真机安装验收。

```sh
ANDROID_GRADLE_PROXY=http://127.0.0.1:7890 node scripts/build-android-release.mjs
```

无需代理时不设置 `ANDROID_GRADLE_PROXY`。构建脚本从仓库外的 `~/.config/qinggai/signing/release.env` 读取签名配置，重新生成被忽略的 Expo Android 目录，编译 ARM64 和 ARMv7，验证签名、16 KB 对齐、应用名称与非调试标志后复制产物。可用 `ANDROID_SIGNING_ENV` 指定其他私有配置文件。

请私下备份 `~/.config/qinggai/signing/` 整个目录。后续分发与上架必须继续使用同一私钥；不要把私钥或签名密码随 APK 发给朋友，也不要提交仓库。

## 小程序与后端必须同时就绪

App 和小程序都连接 `https://qgrg.bebackpacker.com`，正式小程序 AppID 为 `wx066bf055f6b9d415`。2026-10-19 已通过正式凭据验证，并在微信开发者工具实际上传小程序开发版本 `0.1.1`，工具显示「代码上传成功」。上传开发版本不等于已经设为体验版。

朋友联动试用前需完成：

1. 部署 China 后端及 PostgreSQL，验证 `/health` 与 `/ready`；域名 HTTPS 证书必须有效。
2. 服务端填写此 AppID 对应的 `WECHAT_APP_SECRET`，设置 `WECHAT_MINIAPP_ENV=trial`、`ALLOW_DEV_AUTH=false`。
3. 微信公众平台配置 request 合法域名 `https://qgrg.bebackpacker.com`。
4. 在「版本管理」将开发版本 `0.1.1` 设为体验版，在「成员管理」添加朋友为体验成员。
5. 实际验证 App 创建场次 → 微信扫码并确认资料 → App 显示人数 → 主办方发布 → 微信查看回顾。

当前服务器仅获只读授权，部署会话已经准备并本地验证部署包和脚本，但没有执行远端安装。域名检查仍为证书不匹配。APK 构建通过不能代表线上联动已经验收；服务器安装、Nginx/TLS 配置和启动需要用户另行明确授权。不得为试用而关闭 APK 的 HTTPS 校验。

## 安装与使用

- 朋友首次安装：将 APK 传到 Android 手机，在系统安装界面确认安装。支持 Android 7.0 / API 24 及以上的 ARM 设备；不包含 x86 模拟器架构。
- 用户自己的旧开发包使用公共 debug 签名，与本次正式签名不同，不能直接覆盖。请勿为安装而卸载已有录音的旧包；应先安排数据迁移或在另一台手机试用。
- 第一次录音前确保现场人员知情并同意。录音与私人 AI 数据保存在各自手机。
- AI 整理需要每位录音主办方在「我的 → AI 服务」填写自己的阿里百炼 Key。APK 不内置开发者的 Key，小程序参与者不需要配置 AI Key。
- 本轮没有连接 Android 真机，最终 APK 的新安装、长时间录音及线上双端联动仍需真机补测。
