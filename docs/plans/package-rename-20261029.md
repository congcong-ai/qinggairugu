# 应用标识统一（2026-10-29）

用户明确授权将 Android 包名改为 `com.bebackpacker.qinggairugu`，并停用旧品牌技术命名。本次授权覆盖旧AGENTS关于保留包名的限制，已同步更新AGENTS。

## 当前标识

- Android namespace / applicationId：`com.bebackpacker.qinggairugu`。
- pnpm工作区：`@qinggairugu/*`；源码导入、打包匹配、Turbo依赖、部署脚本命令同步。
- App链接协议：`qinggairugu`。
- 新安装本机数据库：`qinggairugu.db`；SecureStore及小程序新存储键使用 `qinggairugu.*`。
- 正式签名配置变量：`QINGGAIRUGU_KEYSTORE_FILE`、`QINGGAIRUGU_KEYSTORE_PASSWORD`、`QINGGAIRUGU_KEY_ALIAS`、`QINGGAIRUGU_KEY_PASSWORD`。本机仓库外release.env已同步变量名，未更换私钥、证书、alias值或口令。
- expo-audio补丁中自定义资源名同步改名，离线重新安装并更新patch哈希。
- 微信申请材料已更新新包名，签名MD5继续为 `8623e2a23bce2dc239c6341073e97b39`（沿用原证书）。

## 数据与发布边界

Android将新包视为另一应用，不能覆盖升级旧包，也不能自动读取旧包的录音、照片、数据库、设备身份或Key。没有卸载、清数据或操作手机。旧应用继续保留；本次没有实现跨包导出/导入，不能宣称数据已经迁移。

小程序AppID不变，读取旧存储键时先复制到新键，成功后才移除对应旧键，保留身份及当前活动。旧键字符串只存在于迁移兼容代码。

PostgreSQL既有业务数据和数据库连接地址不擅自改名。本地现有DATABASE_URL继续连接原数据库；新环境示例使用qinggairugu。迁移启动器在同一事务和锁下将旧迁移账本改名为qinggairugu_migrations，保留版本与校验和；两个账本并存时拒绝启动迁移以防覆盖。没有修改0001–0007历史SQL，没有修改生产数据库。旧账本名称仅用于兼容检测和迁移测试。

release-manifest.json以及历史APK、下载站和验收文档仍是原包真实记录，不能直接替换其中包名来伪装已构建新版。旧历史路径与标识保留作证据。TASK、旧升级提示和历史计划不批量改写；当前执行以本文件和用户最新要求为准。

本次未构建新的完整APK、未安装、未发布、未上传微信代码或部署。正式新包发布前须独立原签名构建、核对Manifest/签名/下载元数据，审核包和微信申请必须采用同一新包名。已有微信申请若仍填旧包名，需在后台修改；若处于审核中，按后台允许方式撤回或待审核后修改，不重复占用两个应用身份。

## 验证

- 离线锁文件安装成功，锁文件依赖版本保持，patch哈希随资源改名更新。
- 九包TypeScript检查通过。
- 25文件142项测试全部通过，包含真实临时PostgreSQL及SQLite。旧账本迁移场景由memory.test.ts覆盖。
- 原生Prebuild成功，生成工程namespace与applicationId为新包名。
- ESLint、Prettier、API构建、小程序Taro构建、Android JS导出均通过。JS导出位置 `/tmp/qinggairugu-rename-export`；Gradle processReleaseMainManifest成功，XML实际包名和链接协议符合新值，且不含旧标识。

日志位于 `/tmp/qinggairugu-rename-*.log`。没有读取或输出手机百炼Key、签名密码或私钥。

迁移账本改名后，回滚服务代码时也必须保留此兼容迁移启动器，不应直接运行旧版启动器，否则旧版会误建旧名账本。生产尚未执行本改名。
