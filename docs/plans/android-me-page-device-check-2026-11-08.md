# Android「我的」页真机复核

日期：2026-11-08

## 本次交付

- Android 安装包：`artifacts/android/qinggai-0.2.4-release.apk`
- 应用版本：`0.2.4`（`versionCode` 8）
- Android 包名：`com.bebackpacker.qinggairugu`
- APK SHA-256：`8972d751c85f3cea5ab75032c17520dfb03d08aa936c78f47e999462a5d5aa40`
- 同版本 R8 mapping 与 Native symbols 已保留在 `artifacts/android/`，其摘要与 `release.json` 一致。

## 真机复核

- 设备：Huawei OCE-AN10，Android 12，设备序列号 `UJN0221415012670`。
- 使用覆盖安装更新现有 App，安装成功；未卸载 App、未清除数据。
- 系统包信息确认版本为 `0.2.4`、`versionCode` 8。
- 实际页面可访问账号、偏好、隐私分组，并显示页脚“当前版本 0.2.4”。
- 账号页显示“已微信登录”，说明更新后当前登录状态仍可读取。
- 本次没有退出该账号或重新发起微信 OAuth，因此没有把现有登录态误报为一次新的授权回跳测试；小程序与 App 的 UnionID 对应也未在本次更新中重新验证。
- 检查本次运行日志未发现 App 的 `FATAL EXCEPTION`。

## 产物与检查

- APK、SHA-256 文件、`release.json`、R8 mapping、Native symbols 均保留为 `0.2.4` 最新已验证 APK 产物集。
- `artifacts/android/qinggai-0.2.3-release.aab` 仍作为不同交付类型的既有产物保留。
- `git diff --check` 通过。
- 已从手机删除本次生成的临时截图，并清理本机 `/tmp` 中的临时截图和 UI 层级转储。
