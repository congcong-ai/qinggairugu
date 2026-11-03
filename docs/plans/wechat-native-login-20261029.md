# Android微信登录接入进展（2026-10-29）

## 已实现与验证

用户提供后台截图显示移动应用已通过，AppID wx2f97ade32e73a58b、Android包名com.bebackpacker.qinggairugu、签名MD5 8623e2a23bce2dc239c6341073e97b39。截图不是微信登录权限和同开放平台绑定的独立验收证据。

根.env中WECHAT_MOBILE_APP_ID和WECHAT_MOBILE_APP_SECRET存在非空配置；没有输出值。2026-10-30用户已确认App与小程序绑定同一微信开放平台，已配置WECHAT_OPEN_PLATFORM_ID为固定内部命名空间qinggairugu-primary-wechat。该变量不是微信颁发的额外Secret，后续不得随意改变；后台绑定确认仍不能代替两端真实UnionID联调。

新增Expo配置插件with-wechat，生成微信包可见性查询、AppID元数据、导出回调Activity、MainApplication原生模块注册和Maven依赖。原生源码放在apps/mobile/native/wechat，Prebuild可重建，未将修改仅留在被忽略android目录。发布源码指纹覆盖新增native目录。

使用腾讯发布的com.tencent.mm.opensdk:wechat-sdk-android:6.8.40，在Maven Central核对版本：
https://central.sonatype.com/artifact/com.tencent.mm.opensdk/wechat-sdk-android

SDK仅在主动授权时初始化，不在App启动时请求微信登录。原生生成32字节SecureRandom state，五分钟有效、单次消费，校验回调state；取消、拒绝、微信未安装、重复点击、超时、模块销毁均有失败处理。进程死亡后不恢复无主授权，不缓存code。不包含支付/分享/个人资料抓取。

新增TypeScript授权适配器authorizeWechat，通过原生模块获取code，服务端验证后只返回产品令牌、userId和crossPlatformReady。仅可信UnionID且平台命名空间已配置时，服务端返回crossPlatformReady=true；false不等同于身份匹配成功。此适配器现已接入“我的 → 我的账号 → 微信登录”，产品令牌仅保存SecureStore。账号切换时重新挂载路由树和录音上下文，清除上一账号内存界面。

服务端测试新增：仅使用移动应用独立凭据交换code、不使用小程序js_code参数、产品令牌能访问本人接口、微信access_token/refresh_token/OpenID/UnionID不返回客户端、缺失UnionID明确不可跨端、微信错误返回401。身份专项7项真实临时PG测试通过。

Android Prebuild成功；Gradle :app:compileReleaseKotlin成功（4分22秒、247项任务）。不等同于完整APK构建、安装或真实微信授权。

## 账号与本地数据（2026-10-30续）

- 未登录仍可录音，不强制注册。默认登录进入独立账号数据库，不自动搬走原匿名历史。
- 用户可显式选择整体认领未归属历史，仅改变本机归属，不上传私人文字和媒体。已有归属或已经建立独立空间的账号不自动整批合并。
- 数据库、设备身份、百炼Key按账号空间隔离。原匿名空间使用原新包数据库；账号记录退出后隐藏，同账号重新登录可恢复。认领后退出进入新的匿名空间。
- 录音、音频导入、照片导入、AI整理、语义搜索、云请求进行时阻止切号；请求从读取身份开始计数，返回数据前再检查账号代次。
- POST /auth/device以产品令牌验证本人并绑定设备，禁止将已有其他用户绑定历史的设备直接转给新账号；同账号重复调用幂等。
- 新增0008_account_devices.sql，为已登录设备要求有效产品令牌，退出后仅靠设备secret不能继续访问。历史迁移未改。
- 退出清除本机产品令牌和云端活动缓存，保留原始媒体、AI同步状态与待执行撤销队列。离线退出明确告知服务端撤销未确认，不伪称旧令牌已经失效。
- 微信code仅服务端交换；微信access_token、refresh_token、OpenID、UnionID不返回App。不自动上传录音、照片或百炼Key；完整转写同步仍单独选择。

## 当前验证与待验收

真实临时PostgreSQL与SQLite回归包含身份匹配、设备归属与撤销、账号数据库隔离、匿名历史认领、繁忙任务拒绝切号及离线退出。测试命令使用TEST_DATABASE_URL=postgres://localhost:5432/postgres和vitest --maxWorkers=2，不跳过数据库用例，不放宽原超时。此前全量并发因超时失败，降低并发后150项全部通过；最后新增云请求初始化锁测试后，27个文件、151项全部通过。

九包TypeScript检查通过；全仓ESLint通过。全仓Prettier检查被media/product-video下147个宣传视频素材文件阻塞，该目录来自其他工作，不在本次登录范围内，不批量改写。登录相关文件另外检查。

Android原生Kotlin已成功编译；完整原签名APK已构建并核对源码指纹、包名、证书及16KB对齐。最终构建信息见下方验收记录。

下一步真实联调：

1. 部署服务端新接口并执行尚未部署的0006、0007、0008迁移，核对生产环境微信凭据与固定平台命名空间。生产部署尚未执行。
2. 安装新包名App，保留旧包及旧包数据，不卸载清数据。
3. 真机验证微信未安装、授权同意/取消、返回App、登录成功；同一微信登录小程序后检查两端相同内部user_id，不以配置或模拟响应替代此验收。
4. 真机验证默认独立空间、显式认领、退出/换号隔离、录音与整理期间拒绝切号、同步撤销队列恢复。

当前没有连接的Android设备，也没有可执行的模拟器，因此本轮未安装App或完成真实微信授权；未部署、上传小程序、发布APK或上传用户媒体。构建成功不等于线上功能已经可用。

## 最终本地检查记录

- 完整测试：/tmp/qinggai-wechat-151.log，27个测试文件、151项通过，包括真实临时PostgreSQL用例。
- 类型检查：/tmp/qinggai-wechat-verified-types.log，九个包全部成功。
- 全仓ESLint：/tmp/qinggai-wechat-final-eslint.log，通过。
- 登录相关格式检查：/tmp/qinggai-wechat-target-format.log和/tmp/qinggai-wechat-final-format.log，通过。
- API构建：/tmp/qinggai-wechat-final-api-build.log，成功。
- 全仓格式检查：/tmp/qinggai-wechat-verified-lint.log，另一路media/product-video素材147个文件有格式问题，未改写。
- ADB设备列表为空，真实微信授权与双端user_id一致性尚未验收。

## 最终 APK 交付

Prebuild与完整原生Release编译成功（18分33秒），但期间修改了云请求的TypeScript保护，源码指纹检查正确拒绝交付该轮候选。随后复用同配置生成的原生工程，增量构建成功（55秒），保留正式脚本全部签名、包名、版本、架构、ZIP/ELF 16KB对齐与源码指纹校验。临时增量脚本已删除，常规构建入口未改。

- 文件：artifacts/android/qinggai-0.2.1-release.apk，50691184字节。
- 版本：0.2.1，versionCode 5。
- 包名：com.bebackpacker.qinggairugu。
- APK SHA256：b32a259d50f0aca2a3faa84bc3ec74ac5b303d70de41f9c7ae868ae7c3391bc2。
- 证书MD5：8623e2a23bce2dc239c6341073e97b39，与微信后台原登记一致。
- 当前源码指纹核对通过，构建清单见apps/mobile/release-manifest.json。
- 构建日志：/tmp/qinggai-wechat-verified-apk.log（原生完整构建与源码变更保护）、/tmp/qinggai-wechat-final-incremental-apk.log（最终交付成功）。
- 腾讯SDK存在R8 stack map警告，当前构建成功；升级SDK或构建工具时须继续检查，不将警告等同真机验证。

此APK连接生产域名https://qgrg.bebackpacker.com；生产新接口尚未部署，不能直接认定登录已可用。未覆盖官网正式下载或应用市场版本。
