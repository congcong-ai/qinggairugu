# Android 发布检查清单

## 构建与身份

- [ ] 确认正式包名；默认 `com.xixisys.pengtou`，通过 `ANDROID_PACKAGE` 配置。
- [ ] 确认应用名「倾盖如故」、version / versionCode；更新 `apps/mobile/app.config.ts`。
- [ ] 确认正式 Logo 图标与 splash；主图标为 1024×1024 PNG，Android 自适应前景为带透明底与安全边距的 1024×1024 PNG。
- [ ] 准备正式 keystore，备份到安全位置，不提交仓库。
- [ ] 在构建进程中设置 `PENGTOU_KEYSTORE_FILE`、`PENGTOU_KEYSTORE_PASSWORD`、`PENGTOU_KEY_ALIAS`、`PENGTOU_KEY_PASSWORD`。
- [ ] 未配置正式签名时 release 产物必须保持未签名，禁止把 debug 签名当正式签名。
- [ ] 设置 `EXPO_PUBLIC_API_URL` 为正式 HTTPS 服务地址。

```bash
export ANDROID_HOME=/opt/homebrew/share/android-commandlinetools
pnpm --filter @pengtou/mobile android:prebuild
cd apps/mobile/android
./gradlew :app:assembleDebug
./gradlew :app:assembleRelease :app:bundleRelease
```

可按当前网络临时增加 Gradle HTTP / HTTPS 代理参数，不将密码或代理写入仓库。debug APK 位于 `apps/mobile/android/app/build/outputs/apk/debug/`；release APK 位于 `apk/release/`，AAB 位于 `bundle/release/`。

日常正式 APK 使用 `pnpm android:build`：从 `~/.config/qinggai/signing/release.env` 读取签名（可通过 `ANDROID_SIGNING_ENV` 指定），自动 prebuild、构建 ARM64 / ARMv7 APK、验证签名与对齐，以及核对实际包名、versionName / versionCode。产物留在 `artifacts/android/`；构建前后比较源码指纹，源码中途变化时不生成有效清单。构建成功会更新 `apps/mobile/release-manifest.json`，该清单需要随代码提交，不包含签名私钥或口令。

更新 App 时必须递增 version 和 versionCode，随后执行 `pnpm android:build`、`pnpm android:publish`、`pnpm android:check-release`。发布前也会检查清单是否对应当前源码；禁止把过时本地 APK 上传。`pnpm server:deploy` 会自动运行同样的官网版本与实际下载文件 SHA256 检查，旧版本或检查失败立即中止。

使用 SDK 的 `apksigner verify --print-certs` 检查签名，记录证书 SHA256；使用 `shasum -a 256` 记录产物校验值。debug 签名仅供开发，不能用于应用宝正式上架。

## 必须在 Android 真机验证

- [ ] 首次启动无需注册；提示现场知情同意；权限拒绝可恢复。
- [ ] 录音 → 暂停 → 恢复 → 完成 → 试听 → 重启后仍存在。
- [ ] 锁屏、切后台、来电 / 蓝牙断开、低存储、进程终止分别测试。
- [ ] 重启后中断文件仍可发现；不把损坏音频标为完整。
- [ ] 持续通知与前台服务正确；完成后麦克风和服务释放。
- [ ] v0.2 使用已有 SQLite + JS 相似度检索，真机确认历史搜索结果与大记录量性能；恢复原生扩展前必须逐库通过 16 KB ELF 检查。
- [ ] 用真实百炼 Key 完成上传、ASR、发言人区分、摘要、向量与引用搜索。
- [ ] 与微信手机完整跑通 TASK.md 第 36 节。
- [ ] 删除与权限边界验证。

## 上架资料

- [ ] 应用宝账号及运营主体材料。
- [ ] 正式 APK/AAB、签名 SHA256 和安装检查。
- [ ] 应用图标、真机截图与功能说明。
- [ ] 可公开访问的隐私政策 URL、用户协议 URL。
- [ ] 麦克风用途：记录用户主动发起的线下交流。
- [ ] 后台录音用途：锁屏或切换应用时继续本次录音。
- [ ] 通知用途：持续显示录音状态。
- [ ] 网络用途：参与者与回顾共享，以及用户主动发起的百炼 AI 处理。
- [ ] 复核最终合并 Manifest，不申请通讯录、摄像头或公共存储访问。

建议简介：倾盖如故，把每一次见面留下来。无需注册即可开始本地记录，邀请在场的人加入，使用自己的百炼 Key 整理对话，并在确认后分享这场回顾。

版本说明草稿：新增本地录音、Session 邀请、参与者资料、百炼 BYOK、本机搜索与共享回顾。仅在真实验收通过后将其用于发布。

## 本机构建记录（2026-10-17）

最终 Gradle 构建成功，耗时 2 分 1 秒。ABI：`arm64-v8a`；包名 `com.xixisys.pengtou`，版本 0.1.0 / 1，minSdk 24，targetSdk 36，compileSdk 37。

| 产物                       | 大小     | SHA256                                                             |
| -------------------------- | -------- | ------------------------------------------------------------------ |
| `app-debug.apk`            | 93.8 MiB | `faf0df93d20198d567f543a436cec518767fcb693f4f62de9b8ad4c64268ef01` |
| `app-release-unsigned.apk` | 31.8 MiB | `da593c76580383fc2b4a28a0ecdf9bb62759f8f6b0fc9ab78affa45ad641bd06` |
| `app-release.aab`          | 26.0 MiB | `645f6dfdfc194ad9a4d3c9bb95ffdde0d29489010d66d6defe2eff4bd946c379` |

所有产物位于 `apps/mobile/android/app/build/outputs/`，Prebuild 会重建原生目录，需要留档时请另行复制产物。debug 使用开发签名，证书 SHA256：`fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`。debug 未内置 JS，需要 `pnpm dev:mobile`。

release APK 和 AAB 已内置 JS bundle 与 `vec.so`。release APK 的 apksigner 校验按预期失败，证明没有使用开发证书冒充正式签名；正式签名、域名和真实链路验收仍待补齐。

最终 release Manifest 已核查：包含后台麦克风服务、录音和通知权限，关闭 Android 备份；不包含悬浮窗、公共存储、生物识别权限。debug 工具自身仍声明调试相关权限，不作为上架权限样本。

## 2026-10-18 · 独立真机测试包

本轮更新后另生成 `/tmp/pengtou-device-test/pengtou-0.1.0-test.apk`，内置代码并使用现有 Android Debug 开发证书签名，可传入手机独立安装。SHA256：`93e65a77499fa3da2ddc45b79913b6f8a47b46c8ef4b514f832d2760b501ff9b`。不作为正式上架包；前一节 10 月 17 日哈希是历史构建记录，当前更新后的未签名 release APK 内容已变化。

## 2026-10-18 · 真机修复后的最新构建

下表为录音持久化修复、中文录音通知、中文搜索示例加入后的最新产物，替代前文历史哈希。

| 文件                       | SHA256                                                             |
| -------------------------- | ------------------------------------------------------------------ |
| `pengtou-0.1.0-test.apk`   | `b7a62269cbf02505da5ae54fabaf46abe39fb8ddef96269a82781061d30b4c6d` |
| `app-release-unsigned.apk` | `491bf56fdec6b83cdbb1393f538f755ff8f0a0533d2410cf08363957548eed5c` |
| `app-release.aab`          | `627845023c5a193585198c9b2980d79f788a51b09c4dfc4ce420165269554dfa` |

测试 APK 使用开发证书，已通过 apksigner 校验；正式 release APK/AAB 保持未签名。中文通知通过 expo-audio 的 pnpm 补丁维护，并在 Mobile package.json 指定该模块从源码构建。升级依赖后必须重新核对补丁与 APK 中的字符串资源，不能只以编译成功认定补丁生效。

独立包已在华为 OCE-AN10 覆盖安装并冷启动，确认默认中文首页、原有 Key 和 AI 结果保留、中文录音通知运行及停止后消失。应用宝生产签名和长时间真机验收仍未完成。

## 2026-10-19 · 正式 Logo 与部署前 APK 检查

已生成正式签名的 `artifacts/android/qinggai-0.1.2-release.apk`：versionName `0.1.2`，versionCode `3`，包名 `com.xixisys.pengtou`，包含 ARM64 / ARMv7，正式 API 为 `https://qgrg.bebackpacker.com`。签名证书与 0.1.1 保持一致，apksigner 与 16KB zipalign 检查均通过。

文件大小为 50,553,398 字节，SHA256 为 `e14c4f280aa82ac38c82bf7e27ccc20a6d5b2e2aa844e33e6fc8904865f4872b`。已从最终 APK 提取自适应前景图，确认与正式 Logo 原生资源逐像素一致；主图标与自适应前景输入均为 1024×1024 PNG。

已验证官网实际下载 / 重定向 / SHA256 校验成功；验证时线上仍为 0.1.1，执行 `pnpm server:deploy` 按预期以状态码 1 终止，未执行 SSH 或 SCP。新版 APK 需要通过 `pnpm android:publish` 发布后，部署前检查才会放行。

本轮完整 lint、9 个工作区 typecheck、隔离服务端构建及其 32 项测试通过；其中 9 项测试覆盖源码与图标变更、旧版本、同版本不同文件、网络失败、错误下载页及检查失败后禁止远端操作。

## v0.2 增量验收

- [ ] 同签名覆盖升级保留录音、Key、AI，SQLite 1/2 升级到 5。
- [ ] m4a/mp3/wav 实际导入、试听、重启和 BYOK；损坏/空间不足/取消选择。
- [ ] 相册导入与直接拍照、相机授权拒绝/重试、持久化、退出重进及删除；网络请求中没有图片上传。
- [ ] 删除系统相册原图后，App 中独立副本仍可查看；删除 App 副本不影响系统原图。
- [ ] 录音、照片页清晰提示本地离线保存、其他设备/小程序不可见，以及卸载/清除数据丢失本机记录；AI 联网提示单独可见。
- [ ] 多设备绑定、解绑、私有文字同步、全文默认关闭、撤销及回顾权限。
- [ ] 锁屏/后台/中断及至少 2 小时真实录音。
- [ ] 正式签名 APK/AAB、versionCode 递增，重新生成发布清单后再发布。

## v0.2 异常恢复补充验收

- [ ] 同场关联两份本机记录，在线/离线均可分别打开，原 ID 不变。
- [ ] 音频导入在选择器、复制、提交阶段终止 App 后重开；完整副本恢复，残缺副本提示重导且不影响其它录音。
- [ ] 文件选择器打开时不能并发整理、开始同场录音、删除或改关联。
- [ ] 本机重新整理或修改发言人匹配后显示待同步，不自动上传或扩大范围；撤销后全文默认不选。

- [ ] APK Manifest 与打包 XML 包含全量备份/换机排除规则；系统备份及换机后不恢复本机媒体、SQLite 或设备凭据，需在支持的真实系统上验收。

## 2026-10-23 v0.2 原生编译证据

ARM64 debug 已实际构建成功，503 项任务通过。产物 `/tmp/qinggai-v0.2.0-arm64-debug.apk`（SHA256 `3569abfee4e2a760c917d58c67740b48b96c5c37b10064a7eb59529174f43637`）；开发签名和 16KB zipalign 通过，包内版本 0.2.0/4、CAMERA/RECORD_AUDIO、28 个 ARM64 原生库及自定义备份/换机 XML 已检查。此包需要 Metro，未真机安装，不是正式发布包。当前默认正式签名配置不可用；保留既有签名身份，待恢复配置后再走 android:build，不能以 debug 签名覆盖正式版。

- [ ] 中国时间凌晨新建活动默认日期仍为当天，编辑/同步/重新打开日期不偏移；不存在的日期不能保存。

## 2026-10-23 原签名恢复与 v0.2.0 签署

已从原 Mac mini 恢复 `~/.config/qinggai/signing/`。配置和 keystore 路径有效，私有目录权限设为 700、配置及密钥文件为 600，未输出密码或私钥。通过只读下载官网当前 0.1.2 APK 核对证书，确认与恢复的签名一致。

对已完成原生构建的双架构未签名 Release 核对当前源码指纹及文件摘要后，使用 SDK apksigner 正式签署，没有修改其业务内容；签名前后 ZIP 中所有原始条目逐项一致。新包 v2/v3 签名、原包证书一致性、双架构、版本包名、16KB ZIP 和全部 ARM64 ELF 校验通过。

- 文件：`artifacts/android/qinggai-0.2.0-release.apk`，50,709,712 字节，版本 0.2.0 / versionCode 4。
- SHA256：`1a158930f74b8532397b75cb80e30a70ca2a9cde81ec1cd1448b9f30a5472a7f`。
- 签名证书 SHA256：`5fb9f9805ba4741171034e3efe50e27b3f42e2b73b4001c00468bdbdcb4140d3`，与官网旧包一致。
- 已更新本地 release-manifest.json 和产物 release.json；签名资料留在仓库外，APK 留在 Git 忽略的 artifacts 目录。
- 校验报告：`/tmp/qinggai-v02-signed-release-validation.json`。

当前 ADB 无设备，未做覆盖安装或录音/照片真机验收；未上传、发布 APK 或部署线上服务。签名一致支持正常覆盖升级，但实际数据保留仍需真机验证，不能通过卸载重装验收。
