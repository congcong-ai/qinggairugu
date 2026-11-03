# Apple 发布进度

更新日期：2026年11月2日。用户已明确授权启动 iOS 发布，覆盖原先暂不做 iOS 的阶段限制。

## 最新状态（以此段为准）

- **2026年11月3日18:21：已补充 iPhone 11 实体录屏与六项审核说明，0.2.3（2）已重新提交，后台显示「等待审核」。尚未上架。**
- 真机录屏：`artifacts/ios/app-store/review-evidence/iphone11-review.mp4`，5分42秒；原片与剪辑区间、验证范围、SHA256均保留。附件刷新后确认处理完成。重新提交凭证：`artifacts/ios/app-store/review-resubmitted.png`。
- iPhone 11 实际报告系统 27.2（24B119），构建2开发重签名，安装和启动通过；用户验证录音暂停继续、保存回放和文字记录。未将示例模式标为真实AI测试。
- 最新开发包更新为构建2，保留商店归档和dSYM；清理旧开发包与临时导出/解包目录，目录表观合计约145 MiB，实际释放空间未测量。

- **2026年11月3日：0.2.3（2）因 Guideline 2.1 Information Needed 被拒，尚未上架。苹果要求最新系统实体设备演示视频及六项说明。补充说明见 `docs/APPLE_REVIEW_INFORMATION.md`，六项补充说明已保存至苹果审核备注，状态为可供审核；符合要求的真机视频尚缺，未重新提交。**

- **2026年11月2日已正式提交审核，苹果后台显示「0.2.3 正在等待审核」。提交版本为 0.2.3（构建 2），免费，审核通过后自动发布。当前尚未上架。**
- 审核提交 ID：`fa40e1a7-d922-45a7-b290-9569c86c66f1`。状态凭证：`artifacts/ios/app-store/review-submitted.png`。

- 首页、短录、锁屏续录、保存、回放均已由用户真机确认；重启后数据库与录音文件检查通过。
- 已修复场景代理类名与 iOS 错调 Android 通知权限接口的问题。
- 构建 1 的开发接口地址已修正；构建 2 的归档与 IPA 均检查通过：构建号 2、正确团队分发签名、包含生产 API 地址、不含开发 API 地址。4 项 cloud 测试、Mobile 类型检查及相关文件格式检查通过。
- 构建 2 已完成上传（`Uploaded app / EXPORT SUCCEEDED`），苹果已处理，已关联版本 0.2.3 并保存出口合规。构建 1 已从版本移除，禁止提交。
- 最新商店产物为 `artifacts/ios/qinggairugu-0.2.3.xcarchive` 与 `artifacts/ios/app-store/app.ipa`，对应构建 2；包含 App dSYM、可获得的模块符号、摘要、manifest 与构建/导出/上传日志。开发真机安装包独立保留。
- 第三方 dSYM 上传仍有警告：ExpoImageManipulator、React、ReactNativeDependencies、SDWebImage、SDWebImageWebPCoder、hermesvm；不可声称全部框架符号上传成功。
- 审核联系人、无需登录说明、副标题、效率类别、内容版权、年龄分级（4+）、免费价格及 175 个国家或地区的供应设置均已保存；关闭 Mac 与 Vision Pro 分发。
- 用户已确认最终隐私声明，苹果隐私标签已发布：姓名、音频、其他用户内容、搜索历史、用户 ID、设备 ID；均用于 App 功能、与用户身份关联、不用于追踪。
- 隐私政策已补充 iOS 范围、锁屏录音与系统备份说明，公开 `/privacy` 已更新并经 HTTP 内容核验；没有部署其他未提交的服务端改动。原页面备份在服务器 shared/backups/privacy-before-ios-20261102.html。
- 模拟器使用 Xcode 正常签名后本机存储读取通过。原生首页截图（1206×2622、JPEG、无透明通道）已上传并处理完成，提交校验通过。
- 构建、导出、上传及模拟器验证结束后已清理项目临时 DerivedData、iOS 代码生成目录、IPA 解包目录与临时导出，并删除被构建 2 替代的旧商店产物；清理前目录表观占用合计约 8.1 GiB，不代表系统实际释放量。保留最新商店 IPA、xcarchive、dSYM、开发包、截图、摘要与日志，详见 app-store/cleanup-manifest.json。

以下保留阶段验证记录，旧状态由上述最新结果覆盖。

## 已核实

- 开发团队：Hangzhou Zhihua Technology Co., Ltd.
- Team ID：`G6692S3U7C`
- Bundle ID：`com.bebackpacker.qinggairugu`，已在开发者后台注册。
- App Store Connect App ID：`6829204637`。
- [发布后台](https://appstoreconnect.apple.com/apps/6829204637/distribution/ios/version/inflight)
- 中文名称：倾盖如故；主要语言：简体中文；SKU：`qinggairugu-ios`。
- 首次版本：`0.2.3`，构建号：`1`。
- 已保存中文描述、关键词、支持网址和版权信息。
- 已生成 Expo iOS 工程，TypeScript、iOS JS 导出和格式检查通过。
- CocoaPods 依赖安装完成；Xcode Release 真机编译已启动。
- Xcode 已识别「王国江的 iPhone」，系统 iOS 16.7.16，可作为构建目标。
- 真机连接期间存在间歇离线；未出现新的信任提示不妨碍 Xcode 识别。
- 原生构建尚未通过：两次构建停在资源编译，`actool` 等待辅助进程；独立工具构建也出现脚本进程停滞。已尝试重启本次构建服务，未获得成功构建证据。
- 11月1日用户重启 Xcode 后重试：已越过资源编译，进入 ExpoModulesJSI 原生编译，已生成部分 ARM64 对象文件；完整构建结果仍待确认。日志：`/tmp/qinggairugu-ios-build-20261101.log`。
- 11月1日重试最终结果：`BUILD SUCCEEDED`。Release ARM64 App 的 `codesign --verify --deep --strict` 校验通过，TeamIdentifier 为 `G6692S3U7C`，Bundle ID 和版本 `0.2.3` 正确。完整产物：`/tmp/qinggairugu-ios-build/Build/Products/Release-iphoneos/app.app`。本次未检测到在线 iPhone，尚未安装或完成真机验收；该结果不代表 App Store 归档、分发签名或上传成功。
- 音频导入及恢复专项测试：9 项通过；不代表真机录音通过。

## 提交前必须完成

11月2日补充验证：关闭并重新启动 App 后读取本机数据库，测试录音 `status=completed`、`duration_ms=24005`，对应场次 `state=completed`，记录持久化检查通过。苹果后台已保存副标题“把每一次见面留下来”、主要类别“效率”和年龄分级问卷（计算结果 4+，未选择面向儿童）。归档前重建了清理过的 ReactCodegen 生成文件；`pod install` 后续报告本地 ReactNativeDependencies podspec 解析问题，但原有 Pods 工程及生成文件仍可继续归档，归档成功与否以最终 xcodebuild 输出为准。iOS 账号页已隐藏仅 Android 可用的微信登录操作并提示继续免登录使用，typecheck/格式检查通过。

11月2日录音修复验收通过：用户确认能听到锁屏前后两段声音。读取本次测试 M4A 验证为 AAC、44100Hz、单声道、24.055873 秒、246834 字节，ffmpeg 完整解码无错误。修正版及 JS sourcemap 已保留到 artifacts/ios，签名复核通过。录音内容仅作本机临时验证，不作为发布附件。开始制作 App Store 归档；重启后记录保留及 AI 全链路仍需进一步验收。

11月2日开始录音时出现通用失败提示：代码在 iOS 上无条件调用仅 Android 实现的 `AudioModule.requestNotificationPermissionsAsync()`。已限制为 Android 平台调用，TypeScript、格式检查及 iOS export:embed 字节码导出通过。复用现有原生 App 更新 JS/资源并重新签名，USB 安装完成，启动命令成功；录音真机复验待用户反馈。候选包暂存 `/tmp/qinggairugu-recording-fix/app.app`，尚未覆盖最后确认可启动的 artifacts 产物。

11月2日用户确认修正场景代理类名后已进入首页，启动问题验收通过。修正版已覆盖保留到 `artifacts/ios/qinggairugu-0.2.3-development.app`，重新校验签名通过，manifest 已更新；开始进行锁屏录音与播放验收。此安装包仍为开发签名，尚未完成 App Store 分发归档。

11月2日用户反馈首页停在 Logo 页：此前“进程运行”不能作为启动验收。发现 Info.plist 使用 `app.SceneDelegate`，而生成源码显式注册 `@objc(SceneDelegate)`。新增 `with-ios-scene-delegate.cjs` 修正生成配置，Expo introspect 检查通过。已在临时目录修正既有 App 的 Info.plist 并重新签名、USB安装及启动，以验证此配置变更，无需重编译二进制；尚待用户确认首页恢复。修正版位于 `/tmp/qinggairugu-scene-fix/app.app`，确认前不替换 artifacts 中的旧产物；旧产物已知存在启动问题，不视为可用发布包。

11月2日已通过 USB 安装到 iPhone 8 Plus（iOS 16.7.16），安装日志显示 `InstallComplete`。启动后设备进程查询得到 PID `6487`；首页显示、录音及锁屏行为仍待人工验证。最新开发签名产物及校验信息保留在 `artifacts/ios/`。已保留可找到的 ExpoModulesJSI dSYM；原 App dSYM 与 xcarchive 当前不存在，不能声称完成分发归档。已清理本项目 `apps/mobile/ios/build` 和 ExpoModulesJSI 的 `.DerivedData`，清理前表观占用约 110 MB，不代表系统实际释放量；未清理共享下载缓存、源码、签名及设备用户数据。

- App Store 归档、分发签名和 IPA 上传（本地 Release 构建及开发签名已通过）。
- iPhone 真机验证麦克风权限、录音、锁屏续录、暂停恢复、播放及重启后文件保留；设备已连接，测试待完成。
- 当前微信原生登录仅实现 Android，iOS 登录路径尚未适配。
- 检查 iOS 本地文件备份策略和第三方 SDK 隐私声明。
- 使用真实 iOS 运行界面准备截图。
- 填写审核联系信息、年龄分级、隐私问卷、销售地区和免费价格。
- 若面向欧盟分发，完成后台提示的交易商状态申报。
- 选择已处理完成的构建后提交审核。

目前仅为“准备提交”，尚未上传 IPA、提交审核或上架。本地可安装 App 已保留到 `artifacts/ios/qinggairugu-0.2.3-development.app`，复制后再次通过签名校验。

## 本机工具

CocoaPods 1.16.2 安装于 `/Users/peter/.rbenv/versions/3.3.0/bin/pod`。
使用该 Ruby 时把 `/Users/peter/.rbenv/versions/3.3.0/bin` 加到当前命令的 PATH。
原生依赖安装日志：`/tmp/qinggairugu-pod-install.log`。
JS 导出验证目录：`/tmp/qinggairugu-ios-export`。
