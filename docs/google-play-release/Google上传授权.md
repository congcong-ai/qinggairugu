# Google 上传授权

更新：2026-11-01。未提交应用审核、未发布生产版本。

## 已完成

- 创建独立 Google Cloud 项目 `qinggairugu-upload-20261031`，显示名称 `QingGaiRuGu Upload`，项目编号 `1088447045898`。Google 项目名称不接受中文，授权工具的 OAuth 名称使用“倾盖如故上传工具”。
- 用户明确确认 API 条款后，启用 Google Play Android Developer API 和 YouTube Data API v3；两项管理页面均显示 Enabled。
- 创建服务账号 `play-upload@qinggairugu-upload-20261031.iam.gserviceaccount.com`，未附加 Google Cloud 项目资源角色。
- 用户确认后，在 Play 中仅为 `com.bebackpacker.qinggairugu` 授予应用只读、依赖的质量信息只读，以及“Release apps to testing tracks”权限。该权限包含上传草稿和测试轨道发布；没有授予生产发布、财务、管理员或其他应用访问权限。Play 显示账号 Active。
- 用户确认后生成 JSON 密钥；保存到 `/Users/peter/.config/qinggai/google-upload/play-service-account.json`，目录权限 0700、文件权限 0600，未写入仓库。本文不包含私钥或访问令牌。
- 已实际验证：Google 令牌签发 200，创建临时编辑会话 200，应用包读取 200、轨道读取 200；随后撤销此次临时会话 204，没有调用提交或发布接口。
- API 读取到版本 6 和 7。版本 7 的 SHA256 为 `94e4ceb985ffb5d4119001ca35091ae8bf3c71433e6d7940433d9004b239bbfb`，与本地 0.2.3 AAB 一致，无需重传。
- 已通过 Console 将旧版 6 从本次发布草稿移除（包仍可从库中恢复），仅保留版本 7；发布名称改为“0.2.3（7）首次上架”，版本说明加入示例体验，页面确认保存成功。

## YouTube 尚待完成

OAuth 品牌表单已预填：名称“倾盖如故上传工具”，支持邮箱为当前 Google 登录账号，开发者联系邮箱 `peter@xixisys.com`，受众为 External 的 Testing 模式。

用户已当次确认并接受《Google API Services: User Data Policy》。OAuth 品牌配置和桌面客户端“倾盖如故上传工具（桌面）”均已创建。客户端 JSON 下载触发 Chrome 原生保存窗口连续超时；已请用户将文件保存至 `/Users/peter/.config/qinggai/google-upload/youtube-oauth-client.json`。尚未添加本人测试用户或取得频道授权令牌。客户端创建不代表频道授权已完成。

计划只请求 `https://www.googleapis.com/auth/youtube.upload`。最终需在实际 Google 授权页面核对权限和目标频道；不得把 Play 服务账号当作个人 YouTube 频道授权。

## 网络与临时文件

当前系统代理为 Clash Verge `127.0.0.1:7897`，旧的 ClashX 7890 端口已关闭。Google 端点和以上 API 验证均通过 7897 完成，启用 TLS 证书验证。当前 Python 3.10 使用系统 CA 文件 `/etc/ssl/cert.pem`；未跳过证书检查。

临时 API 验证输出：`/tmp/qgrg-google-play-auth-check.json`、`/tmp/qgrg-google-play-packages.json`。其中仅包含状态码、版本摘要和轨道信息，无凭据。

尚未把 Google 凭据分发到服务器，也未配置 COS 或美国服务器上传链路。临时中转文件传完应立即清理；已提供给审核员的视频网址必须在审核期间保持可访问。
