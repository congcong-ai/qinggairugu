# 微信登录部署与安装包发布验收（2026-10-30）

## 发布结果

- Android版本：0.2.2，versionCode 6。
- 包名：com.bebackpacker.qinggairugu，沿用微信后台登记的原证书。
- 本地文件：artifacts/android/qinggai-0.2.2-release.apk，50691184字节。
- SHA256：9e9782e968e8b3f4c8a5d2622f075b81400a0a5377daa48eee49e04b24609562。
- 安装包发布页：https://gitcode.com/xixisys/qinggairugu-releases/releases/v0.2.2
- 官网下载：https://qgrg.bebackpacker.com/download/android
- 生产release：/var/www/qinggai/releases/20261029T235144Z-5a4bed48（目录名为UTC时间）。
- 迁移前数据库备份：/var/www/qinggai/shared/backups/20261029T235144Z-5a4bed48.dump，36651字节。

远端已有内容不同的0.2.1附件，发布脚本正确拒绝覆盖；递增到0.2.2/versionCode 6后构建和发布。Expo Prebuild复用既有工程，完整Release构建、签名、双ARM架构、16KB对齐及源码指纹检查均通过。APK及校验和上传后均从远端回验，未改动GitHub远端。

生产三项移动微信配置与本地逐项摘要比对一致，原生产.env已备份，未输出凭据。使用已通过检查的后端发布包，复用标准deploy-remote脚本的下载门禁、校验传输、server-deploy、备份、迁移、健康检查与失败回滚；仅复用构建产物，未跳过验证。临时包装脚本已清理。

## 验证结果

- 发布包8个测试文件、45项测试通过，API类型检查、格式检查和构建通过。
- 初次发布包检查因本机并发编译导致子进程测试超时而停止；scripts/build-release.sh将测试并发降为2后原断言及原超时全部通过，没有跳过失败用例。
- 线上API与数据库健康均200，服务名qinggairugu-api。
- 生产迁移账本为1至8，installations.account_required字段存在。
- 10项公网检查全部通过：健康、数据库健康、版本信息、空移动登录请求400、无效移动授权码401、生产开发登录码401、无令牌设备绑定401、无令牌退出401、匿名本人资料401、无效Bearer本人资料401。
- 首次手工探测误用了不存在的/me路径得到404，已按实际/me/profile更正探测，并非业务代码失败。
- 官网版本与实际下载SHA256重复校验通过，当前为0.2.2。
- ADB最终设备列表为空；没有安装、录音或真实微信授权回跳测试。无效code测试不代表真实微信同意授权成功，也不代表两端相同user_id已真机验收。

## 后续真机路径

安装新版 → 我的 → 我的账号 → 微信登录 → 微信同意授权 → 返回App；同一微信进入小程序后，验证内部user_id一致，再检查取消授权、退出、换号、认领与录音期间切号保护。新包名不覆盖旧包，旧包记录不自动迁移，保留旧包数据。

## 验证日志

- /tmp/qgrg-022-build.log
- /tmp/qgrg-022-publish.log
- /tmp/qgrg-server-build-retry.log
- /tmp/qgrg-022-deploy.log
- /tmp/qgrg-022-online-tests-final.json
- /tmp/qgrg-022-final-download-check.log
