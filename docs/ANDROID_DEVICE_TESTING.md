# Android / 华为鸿蒙 4.2 真机测试

## 是否必须连接电脑

不强制一直连接。安装包类型决定启动要求：

| 安装包                             | 可否直接传到手机安装 | 是否需要本机 Metro              |
| ---------------------------------- | -------------------- | ------------------------------- |
| debug APK（Custom Dev Client）     | 可以安装             | 需要，USB 转发或同一 Wi-Fi 连接 |
| release-unsigned APK               | 不能直接安装         | 需要先签名                      |
| 独立测试 APK（内置代码、开发签名） | 可以安装             | 不需要                          |
| 正式签名 release APK               | 可以安装             | 不需要                          |

鸿蒙 4.2 设备可按 Android APK 路径尝试安装与调试，具体机型兼容性以实际安装和录音测试为准。第一次建议用 USB，便于查看日志、定位权限和后台服务问题。

独立测试包使用公开的开发证书，仅供测试；与当前 debug 包同包名、同证书，覆盖安装可保留数据。不要为切换安装方式随意卸载，卸载会丢失本机录音和安全存储中的 Key。正式签名包与开发证书不同，发布前需另行安排数据保留方案。

## 推荐：USB 调试

1. 用可传数据的 USB 线连接 Mac 与手机，手机保持解锁。
2. 手机设置 → 关于手机 → 连续点击版本号，开启开发者选项。
3. 开启「USB 调试」，接受手机上对本机的调试授权。这里使用 ADB，不是华为手机助手的 HDB 功能。
4. 在本机检查并设置转发：

```bash
adb devices -l
adb reverse tcp:8082 tcp:8082
adb reverse tcp:9001 tcp:9001
pnpm dev:api
# 另一个终端
pnpm dev:mobile
# 安装已构建的开发包
adb install -r apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk
# 开发包安装完成后，连接到本机项目
adb shell am start -a android.intent.action.VIEW -d 'exp+pengtou://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A8082' com.xixisys.pengtou
```

`adb devices` 必须显示 `device`；`unauthorized` 表示需要在手机上允许。多台设备连接时，各命令使用 `adb -s <序列号>` 指定目标。

本机已为 USB 调试在 `apps/mobile/.env` 设置 `EXPO_PUBLIC_API_URL=http://127.0.0.1:9001`。修改该文件后重启 Metro。开发客户端连接 `http://127.0.0.1:8082`。USB 转发仅供开发，正式版需要 HTTPS 服务地址。

同一 Wi-Fi 也能连接开发服务：将 API 地址改为 Mac 的局域网地址，并在开发客户端打开 Mac 的 8082 端口，确保防火墙允许访问。不同网络或 Wi-Fi 客户端隔离可能阻断连接。

## 独立测试包

将测试 APK 传到手机，在手机文件管理器中打开并按系统提示允许该来源安装。安装后无需电脑即可测试本地录音、试听、重启恢复，以及使用手机内填写的百炼 Key 整理和搜索。AI 处理仍需联网。

当前没有正式 HTTPS 后端及真实微信配置时，独立测试包的云端邀请/共享流程不能完整测试。本地录音与百炼直连不依赖小程序 AppID。

## 录音测试顺序

- 首次启动 → 允许麦克风与录音通知 → 开始 → 暂停 → 继续 → 完成。
- 试听，确认内容与时长；重启后再次试听。
- 分别进行锁屏、切后台、来电等中断测试，每次先用短录音确认。
- 检查系统是否显示持续录音通知；结束后确认麦克风指示与服务退出。
- 华为设备若后台录音中断，检查应用启动管理、电池限制和麦克风权限，记录原始系统设置后再对比测试；不能只依赖用户关闭省电策略来认定功能可靠。
- 进程被终止后，确认能找到中断片段，完整试听后再确认用于 AI。

## 百炼 Key

产品内：手机「我的 → AI 服务」输入北京地域 Key → 测试连接 → 保存。保存在 SecureStore，不会自动读取电脑 `.env`，也不向倾盖如故后端传送。

开发验证：根目录 `.env` 的 `DASHSCOPE_API_KEY` 仅由 `pnpm ai:test` 本机命令读取。命令用公开测试句子验证模型能力并产生少量调用费用，不打印 Key，不读取私人录音。微信 AppID 和 AppSecret 分别填同文件的 `WECHAT_APP_ID`、`WECHAT_APP_SECRET`，AppSecret 仅后端使用。

本轮独立测试包：`/tmp/pengtou-device-test/pengtou-0.1.0-test.apk`，31.9 MiB，ARM64，内置代码与开发签名均已检查。目录位于临时空间，后续需要长期留存时请复制到自己的测试包目录。

华为官方 USB 设置参考：[华为设备连接与开发者选项](https://consumer.huawei.com/cn/support/content/zh-cn16005206/)；ADB 的授权与无线连接参考：[Android 调试桥](https://developer.android.google.cn/tools/adb)。

开发包中的 Expo 启动器和开发菜单可能使用英文；它们用于开发连接，不属于产品语言界面。产品体验验收优先使用独立测试包，直接进入中文首页。
