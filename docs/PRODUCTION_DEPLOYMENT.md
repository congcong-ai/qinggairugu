# 倾盖如故 China 生产部署

当前状态：**China API 已完成首次部署**，公网地址为 `https://qgrg.bebackpacker.com`。用户已明确授权远端写入并自行完成首次安装；2026-10-19 执行首次 `pnpm server:deploy china` 成功。后续部署继续使用已有授权范围，不修改其他项目、DNS 或共享数据库配置。

## 架构与边界

仅部署 Hono API：`https://qgrg.bebackpacker.com` → Nginx → `127.0.0.1:<审计端口>` → PostgreSQL。本项目路由直接为 `/sessions`、`/auth/wechat`、`/health` 等，不添加 `/api` 前缀。不部署 Web 前端、Android App 或微信小程序到服务器，不使用 Docker、Redis、对象存储或支付。

原始录音、完整私人转写、私人 AI 分析、Embedding 和用户百炼 Key 不进入服务器。服务器只保存场次基本信息、参与者与确认发布的回顾。生产配置模板见 `deploy/production.env.example`；不得复制开发根 `.env` 到服务器。

## 2026-10-19 安装前只读核查（历史记录）

- China：`deployer@49.235.209.193:22`，主机 `xixisys-cn`，Ubuntu 24.04.4。
- Node 22.23.1、pnpm 11.17.0、PM2、Nginx、Certbot 和 PostgreSQL 16.10 已具备；根盘剩余约 14 GiB。
- 域名 A 为 `49.235.209.193`，未查到 AAAA。HTTPS 当前返回域名不匹配的证书；不视为本项目服务可用。
- 未发现 `/var/www/qinggai`、对应 Nginx 站点或证书。完整监听与配置审计暂时建议 API 端口 **10240**，安装时必须重新审计并确认。
- **9001 已属于 smartbadge**，不得使用本地开发脚本清理服务器端口。发布仅停止 `qinggai-api`；停止后仍占用端口就退出，绝不终止其他项目。
- 系统 PostgreSQL 当前 `listen_addresses=*`，监听 0.0.0.0:5432；没有检查防火墙/云安全组，所以不能据此判断公网是否可达。本项目连接固定 `127.0.0.1`，不自动修改共享实例配置，也不新增数据库公网暴露。
- 核查未调用 PM2 CLI，未读取 `.env`、进程环境或证书私钥；端口工具只从 PM2 dump 提取端口数字，不输出完整环境。审计通过 SSH stdin 执行，不在服务器写入脚本文件。

只读复查：

```bash
pnpm server:ports
```

## 本地发布包

```bash
pnpm server:build /tmp/qinggai-release.tar.gz
shasum -a 256 -c /tmp/qinggai-release.tar.gz.sha256
tar -tzf /tmp/qinggai-release.tar.gz
```

构建在临时副本内执行 frozen/offline install、API lint、部署文件格式检查、API 及依赖类型检查、基础 API/二维码测试和编译，不影响用户未提交素材。离线缓存不足时先在本机执行 `pnpm install --frozen-lockfile` 补齐；必要时使用命令级 ClashX 代理。

显式打包 API 与 migration 的 JS、历史 SQL、API 依赖的 workspace manifests、裁剪非服务端 importers 后的锁文件（保留原版本与 integrity）、锁文件需要的补丁、服务器脚本及配置模板；不含应用 `.env`、Git、本机 node_modules、移动端/小程序源码或用户 assets。没有新增依赖，没有修改历史 migration。服务器只安装 Linux production dependencies，不构建源码。

## 首次安装

```bash
cp .deploy.env.example .deploy.env
LETSENCRYPT_EMAIL=实际证书通知邮箱 pnpm server:install china
```

脚本先只读判断安装标记，已安装立即退出。首次创建独立 `qinggai` 系统用户、数据库及角色；已存在同名资源时停止检查，避免覆盖密码。依赖缺失或 pnpm 版本不匹配时停止，不自动升级共享服务器组件。若确实缺依赖，应先 `apt-get check` 与 APT 模拟，审阅有无升级或删除，再按新授权安装所缺组件；当前服务器无需此步骤。

审计并确认端口后，生成 `/var/www/qinggai/shared/.env`，数据库随机密码仅保存在该文件（root:qinggai，0640）。创建独立 Nginx 站点，校验后 reload 并由 Certbot 申请证书。已有同名站点一律不覆盖。安装中断不会自动删除资源；先核查已执行阶段，再按明确授权恢复，不能盲目重跑或删除已有数据。

安装完成后，用户在服务器 `shared/.env` 填写正式 AppID 对应的 `WECHAT_APP_SECRET`。正式小程序尚未发布时，可明确设置 `WECHAT_MINIAPP_ENV=develop` 或 `trial` 验证；正式上线必须改回 `release` 并发布 `pages/session/index`。

配置校验失败时会逐项列出变量名与要求，不输出配置值。体验版环境应填写 `WECHAT_MINIAPP_ENV=trial`，不要误写为 `trail`。

目录：

```text
/var/www/qinggai/
├── current -> releases/<release-id>
├── releases/                  # 当前 + 上一个健康版本
└── shared/
    ├── .env
    ├── install.env
    ├── .install-complete
    ├── deploy.lock
    ├── backups/
    └── logs/
```

## 日常发布

```bash
pnpm server:deploy china
```

入口在任何 SSH、构建发布包或上传之前检查 Android 下载包：当前 Mobile 源码、图标、共享代码、依赖与构建配置必须匹配 `apps/mobile/release-manifest.json`，官网 `/downloads/release.json` 的版本必须一致，且实际从 `/download/android` 下载到的 APK 大小与 SHA256 必须匹配清单。线上旧包、同版本不同文件、无法下载或无法确认版本时，打印原因并以非零状态终止部署，不继续操作服务器。

App 更新时先提升 `apps/mobile/app.config.ts` 的 version 与 versionCode，再执行：

```bash
pnpm android:build
pnpm android:publish
pnpm android:check-release
pnpm server:deploy china
```

`android:build` 沿用仓库外的正式签名配置，输出 APK、SHA256 和 `artifacts/android/release.json`，并生成需要随源码提交的 `apps/mobile/release-manifest.json`。仅后端、官网或部署文档变化无需重打 APK；Mobile 或共享代码变化后清单会失效，需要重新构建并发布。检查只读取官网和公开附件，不需要将 GitCode Token 传给官网或下载 CDN。网络失败时同样终止，可修复后重试；没有跳过检查的部署开关。

用户已授权本项目的常规安装与发布，显式执行入口即可，无需再设置 `QINGGAI_REMOTE_WRITE_APPROVED`。服务器内部脚本仍由入口传递调用标识并要求 root 权限。仅允许 China；其他目标立即拒绝。先构建并校验 SHA256，再唯一目录解包，使用 flock 避免并发。锁文件与 Node ABI 未变且上版依赖完整时复制上版 Linux dependencies，否则安装 frozen production dependencies，并使用 `--no-optional` 排除 Drizzle 在完整工作区锁文件中关联的可选 Expo SQLite 依赖。PostgreSQL 是直接依赖，仍正常安装。发布前校验正式微信配置、关闭开发身份和本机数据库地址；数据库密码不会传入命令行。

先创建并检验 pg_dump 备份，再执行现有增量 migration。原子切换 `current`，启动专用用户的 `qinggai-api`。首次健康通过后保存 PM2 状态并交给 `pm2-qinggai` systemd，验证 active/enabled 及再次健康检查。密钥由 Node 启动时读取，不注入 PM2 dump。成功后仅保留当前与切换前的健康版本；备份不自动删除，需按磁盘容量安排保留策略。

## 健康与真实业务验收

```bash
bash scripts/health-check.sh https://qgrg.bebackpacker.com
# 以下服务器命令也须在授权范围内运行
sudo nginx -t
systemctl is-active pm2-qinggai
systemctl is-enabled pm2-qinggai
```

`/health` 检查服务标识；`/health/db` 实际查询 sessions 表，能发现未迁移或数据库不可用，失败只返回通用状态。发布脚本不自动创建测试用户或业务数据。

生产双端构建前分别设置：

```dotenv
EXPO_PUBLIC_API_URL=https://qgrg.bebackpacker.com
TARO_APP_API_URL=https://qgrg.bebackpacker.com
TARO_APP_DEV_AUTH=false
```

前者放 `apps/mobile/.env`，后两者用于小程序构建进程；不可把微信 Secret 或百炼 Key 放入公开构建变量。还需在微信公众平台配置 HTTPS request 合法域名，这也是外部配置写入，当前未操作。

HTTPS 上线后，在真实手机验证：App 创建场次 → 官方码 → 微信真实登录 → 加入/复用资料 → App 人数更新 → App 确认发布 → 微信读取同场回顾。当前的本地验收不能替代生产双端验收、长时间录音或两台设备同时验收。

## 回滚

切换或启动后的健康检查失败，会停止本项目并恢复旧 current、重启旧版和检查健康。没有旧版时移除首次发布的 current。迁移前失败不切换。数据库不自动逆向迁移；已有历史 SQL 不得修改。后续 schema 变更必须向后兼容并新增 migration。

手动回滚也属于远端写入。取得授权后，先确认旧版本目录与数据库兼容性，持有 `shared/deploy.lock`，仅停止 qinggai-api，恢复 current 指向保留版本，再以专用用户运行该版 ecosystem、检查健康并 pm2 save。不要对其他项目执行端口清理或 PM2 delete all。备份恢复会覆盖数据，需单独评估并授权，不作为普通代码回滚步骤。

## 首次上线前的授权与输入（历史记录）

实际安装需要明确允许：上传临时包、创建目录/用户/数据库、执行迁移与备份、启动本项目 PM2/systemd、新建 Nginx 站点并 reload、申请 TLS。还需要真实证书通知邮箱、用户填写正式微信 Secret，以及微信合法域名设置。当前未执行任何上述远端写入。

## 上线前本地验证结果（历史记录）

2026-10-19 已实际完成：

- 隔离构建通过，API/数据库/contracts 三个 workspace 类型检查通过，7 项 API 测试通过（含真实临时 PostgreSQL）。
- Shell 语法、部署相关 JS lint、格式检查、生产环境正反向配置检查通过；未授权安装与发布入口均以状态码 2 拒绝执行。
- 最终发布包 `/tmp/qinggai-china-final.tar.gz` 的 SHA256 与结构检查通过，68 个归档条目，不含 Secret、node_modules、客户端源码或用户素材。
- 最终包在临时目录按 frozen/offline/production/no-optional 安装，仅 47 个运行依赖；使用该包在本机临时数据库执行两次编译后的 migration，记录仍为 1 条；生产模式 API 的健康检查、数据库查询与身份创建通过。测试数据库与进程均已清理。
- 服务器核查只读完成。Linux 实际安装、PM2/systemd 启停、Nginx/TLS 申请和回滚故障注入尚未执行，须在明确远端写入授权后验证；不能把本地结果表述为上线成功。

## 2026-10-19 首次部署结果

用户确认首次安装完成并授权部署后，已实际执行 `QINGGAI_REMOTE_WRITE_APPROVED=yes pnpm server:deploy china`，最终退出码为 0。

- 当前 release：`/var/www/qinggai/releases/20261019T042419Z-dd1d9503`。
- API 仅监听 `127.0.0.1:10240`，以 `qinggai` 专用用户运行；`pm2-qinggai` 为 active 且 enabled。已通过 systemd 重启接管后的健康检查，未重启整台服务器。
- 公网 `/health`、`/health/db` 均返回 HTTP 200 与 `status=ok`，TLS 证书验证成功，HTTP 自动 301 跳转 HTTPS。
- PostgreSQL migration 版本 1 已执行，重试时保持幂等。迁移前备份已生成于 `shared/backups/` 并通过目录列表校验，未执行数据库恢复。
- Nginx 配置校验通过。共享服务器已有其他站点的 protocol options 警告，本次未改动那些配置。
- 修复首次部署发现的三个问题：不存在 current 时误判旧版本；PostgreSQL 多版本客户端环境不同导致备份校验失败；PM2 子进程继承不可访问目录。另改用 ustar 发布包，避免携带 macOS 扩展属性。
- 本次构建中的格式检查、三项 workspace 类型检查、四项基础 API/二维码测试通过；没有修改历史 migration 或输出真实 Secret。

这里只确认 API 部署及运行检查完成。正式域名下微信登录、官方小程序码与 App/微信双端业务链路仍需真机验收；正式小程序的合法 request 域名与页面发布状态尚未通过本次部署核实。

## 2026-10-19 日常部署入口与官网更新

已移除本地入口沿用的只读阶段临时拦截。在未设置 `QINGGAI_REMOTE_WRITE_APPROVED` 的环境下，实际执行 `pnpm server:deploy china` 成功，服务器内部调用校验保留。

此次发布已包含当前官网构建产物及其公开路由。公网根地址 `https://qgrg.bebackpacker.com/` 实测返回 HTTP 200、`text/html`，标题为「倾盖如故 · 把每一次见面留下来」；`/style.css`、`/main.js` 与数据库健康检查均通过。此前线上仅有 API 版本时，根地址返回「资源不存在」，现已随完整发布恢复。

## v0.2 增量发布注意事项

用户最新要求：录音和图片只在手机本地，不部署 OSS，不增加照片表、上传路由或图片处理服务。服务端新增私人文字心得、用户主动授权的 AI 文本副本和身份绑定，边界以更新后的隐私政策为准。原音频、图片、向量和 BYOK Key 不上传产品服务器。

新增迁移 0002–0005；0001 保持原 checksum。迁移器校验全部历史版本，发布前进行备份和旧数据副本演练。应用回滚保留新增表/字段，不执行破坏性 down migration。SQLite 升级后须使用兼容修复包，不直接降装旧 APK。

本次未部署生产或发布安装包。新的 Mobile/共享代码使旧 release-manifest 失效，需原生验证、正式 APK 重建及现有摘要检查后再发布，不绕过检查。

## v0.2 私有文字同步的代理兼容

默认请求大小不变，仅 `/me/private-ai` 的精确路径允许 4 MiB；服务端继续限定字段与身份、版本和绑定权限。首次安装使用新模板。日常发布先调用 upgrade-nginx.mjs，识别既有受管 API 代理并保留 Certbot 证书、HTTPS 与重定向配置，原文件以 0600 权限备份到 shared/backups/<release>.nginx.conf。语法检查或重载失败时恢复原配置；重试可复用内容相同的备份，不覆盖不同的恢复依据。未知站点或端口不符时停止修改。

这条代理规则兼容旧 API，后续应用回滚保留该规则，不做破坏性回退。此代码只在原有明确授权的远端发布入口执行；本轮仅在临时本机 Nginx 验证，没有修改线上服务。
