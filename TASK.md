# TASK.md

# 倾盖如故 MVP — 第一阶段 Codex 开发任务

> 本文件描述当前这一次开发任务。  
> 长期产品与工程规则以 `AGENTS.md` 为准。  
> 如 TASK.md 与 AGENTS.md 冲突，以 AGENTS.md 为准。

---

# 0. 当前阶段目标

从零开发一个可以真实运行的：

# 倾盖如故 MVP

包含：

1. Android App
2. 微信小程序
3. 轻量 Backend
4. 阿里百炼 BYOK
5. 本地录音
6. 本地 AI 记录
7. 本地语义搜索
8. 小程序参与者资料
9. Session 二维码
10. 共享“这场回顾”

当前明确：

- 只做 Android
- iOS 暂不做
- HarmonyOS 暂不做
- 不做支付
- 不做微信支付
- 不做支付宝
- 不做 IAP
- 不做 Mock Pay
- 不做订阅
- 不做充值

第一版上线以后：

再使用正式应用市场链接申请微信 App 支付。

---

# 1. 先检查环境

开始时：

1. 检查当前工作目录。
2. 检查是否已经有项目。
3. 如果为空，创建新项目：
   `pengtou`
4. 检查：
   - Node.js
   - pnpm
   - Android SDK
   - Java
   - Expo 环境
   - 微信开发者工具可用情况

不要因为某个外部工具暂时缺失而停止所有开发。

记录必要环境要求到 README。

---

# 2. 初始化 Monorepo

建立：

```text
qinggai/
├── apps/
│   ├── mobile/
│   ├── miniapp/
│   └── api/
│
├── packages/
│   ├── contracts/
│   ├── database/
│   ├── ai/
│   ├── shared/
│   ├── design-tokens/
│   └── config/
│
├── docs/
├── AGENTS.md
├── TASK.md
├── pnpm-workspace.yaml
├── turbo.json
└── package.json
```

使用：

- pnpm workspace
- Turborepo
- TypeScript

根命令至少：

```bash
pnpm install
pnpm dev
pnpm dev:mobile
pnpm dev:miniapp
pnpm dev:api
pnpm build
pnpm lint
pnpm typecheck
pnpm test
```

确保 skeleton 阶段：

- install 成功
- lint 成功
- typecheck 成功
- build 基础通过

---

# 3. Mobile Skeleton

创建：

Expo React Native App。

目标：

Android First。

使用：

- Expo Router
- Expo Prebuild
- Custom Dev Client

先完成基础页面：

```text
首页
记录
人
我的
```

但第一阶段最重要的首页：

```text
倾盖如故

把每一次见面留下来。

[ 🎙 开始记录 ]

最近
...
```

UI 必须认真做。

不要只用默认组件堆起来。

---

# 4. 真机录音

这是第一优先级。

完成：

- 麦克风权限
- 开始录音
- 暂停
- 恢复
- 完成
- 本地文件保存
- 录音时长
- 简单波形/音量反馈
- 后台录音
- 锁屏继续录音
- Android foreground service
- 中断恢复
- checkpoint

创建 Session 时：

用户无需输入标题。

自动：

```text
10月17日 14:32 的记录
```

完成后可改名。

---

# 5. 本地 SQLite

创建正式 migration 系统。

至少建立：

```text
sessions
recordings
participants
transcript_segments
speakers
speaker_person_links
summaries
topics
actions
embedding_chunks
local_settings
ai_jobs
```

第一次真实录音后：

必须正确写入：

- Session
- Recording
- 本地路径
- duration
- created_at

重启 App 后仍可看到。

---

# 6. Session 云端 API

Backend 建立：

- PostgreSQL
- Drizzle
- Hono
- Zod
- OpenAPI

实现核心 API：

```text
POST /sessions
GET /sessions/:id
PATCH /sessions/:id
POST /sessions/:id/join
GET /sessions/:id/participants
POST /sessions/:id/recap
GET /sessions/:id/recap
```

根据实际结构可以调整。

Mobile 用户第一版允许匿名 device identity。

---

# 7. “让大家加入”

录音过程中：

提供按钮：

# 让大家加入

行为：

1. 如果当前 Session 只有本地数据，则创建云端 Session。
2. 获得 cloud session id。
3. 生成对应二维码。
4. 展示二维码。
5. 显示：
   `已有 X 人加入`

不要要求用户提前创建活动。

---

# 8. 提前创建一场

首页提供次级入口：

`创建一场`

字段：

- 名称
- 时间，可选
- 参与者可见范围

可见范围：

```text
本场参与者互相可见
仅主办方可见
```

创建后：

生成二维码。

进入 Session 后：

可以点击：

`开始记录`

---

# 9. Mini Program Skeleton

使用：

Taro + React + TypeScript。

第一阶段页面：

```text
pages/session/index
pages/profile/edit
pages/session/people
pages/session/recap
pages/me/index
pages/me/sessions
```

底部/Session 内导航：

```text
这场
都有谁
回顾
我的
```

---

# 10. wx.login

实现：

微信小程序用户通过：

`wx.login`

完成匿名身份建立。

第一版不要：

- 手机号
- 邮箱
- 密码

如果真实小程序 AppID 暂缺：

建立开发模式。

把所需配置记录到：

`docs/NEED_FROM_OWNER.md`

---

# 11. 小程序扫码加入

二维码进入：

```text
/pages/session/index?sid=<session_id>
```

显示：

```text
AI 智能硬件 Coffee Chat

今天 18 个人在这里。

[ 加入这场 ]
```

如果是临时 Session，也使用同样机制。

---

# 12. “认识一下 / 关于我”

加入时填写：

必填尽量少：

- 名字 / 昵称
- 一句话介绍

可选：

- 最近在搞什么
- 今天想聊什么
- 想认识什么样的人
- 可以找我聊什么
- 公司 / 组织
- 职业
- 城市
- 公开账号链接

UI 不要做成简历。

---

# 13. 保存资料 / 仅本场

提交时：

明确允许选择：

```text
保存，下次直接用
仅本场使用
```

如果保存：

与小程序用户绑定。

下次进入其它 Session：

展示：

```text
欢迎回来

王小明
最近在搞 AI 智能硬件

[ 就用这个加入 ]
[ 修改 ]
```

不要自动无确认加入。

---

# 14. “都有谁”

如果：

`participant_visibility = everyone`

参与者可以查看本场人员。

卡片展示例如：

```text
王小明
最近在搞 AI 智能硬件
想认识海外渠道

Lisa
跨境品牌
最近在做 TikTok
```

如果：

`organizer_only`

参与者不可查看其他人。

主办方 App 仍可查看参与者。

---

# 15. App 实时看到参与人数

Mobile 当前 Session 页面：

必须可以看到：

```text
已有 12 人加入
```

并显示：

- 名字
- 一句话介绍

第一版可以：

- polling
- lightweight refresh

不必为了实时性上 WebSocket。

除非确有必要。

---

# 16. BYOK 设置

Mobile：

`我的 → AI 服务`

页面：

```text
AI 服务

阿里云百炼

API Key
[ **************** ]

[ 测试连接 ]
[ 保存 ]
```

要求：

- SecureStore 保存
- 不上传后端
- 不打印
- 不 analytics
- 可删除
- 可更换

没有 Key 时：

结束录音后可以正常保留录音。

AI 按钮提示：

```text
配置 AI 服务后可进行转写、摘要和搜索
[ 去配置 ]
```

不要做付费弹窗。

---

# 17. BailianProvider

在：

`packages/ai`

实现：

`BailianProvider`

至少抽象：

```ts
transcribe()
summarize()
embed()
```

使用阿里百炼当前稳定、未废弃接口。

开发时先查当前官方文档。

不要硬编码旧模型。

模型 ID 放配置层。

---

# 18. 真实 AI 处理路径

用户录音结束：

如果配置了 API Key：

显示：

# AI 整理本场

点击后：

```text
录音
↓
ASR
↓
Speaker Diarization
↓
Transcript
↓
Summary
↓
Topics
↓
Actions
↓
Embeddings
↓
Local SQLite
```

处理状态：

```text
准备中
上传中 / 处理中
正在转写
正在整理
正在建立搜索索引
完成
失败
```

如果接口是异步任务：

正确实现轮询/状态恢复。

---

# 19. 开发 Mock AI

允许为开发自动化准备：

`MockAIProvider`

用途：

- UI 开发
- 自动化测试
- 无百炼 Key 的本地测试

但注意：

这是开发工具，不是产品主流程。

用户第一版真实使用：

必须 BYOK。

Mock AI 示例数据：

```text
Speaker 1:
大家好，我最近在做一个 AI 硬件项目……

Speaker 2:
我主要做深圳供应链……
```

---

# 20. Speaker 匹配

AI 返回 Speaker 后：

主办方看到：

```text
Speaker 1 → [ 王小明 ▼ ]
Speaker 2 → [ Lisa ▼ ]
Speaker 3 → [ 暂不确定 ]
```

参与者选项来自：

当前 Session participants。

绑定后：

Transcript segment 写入对应 participant/person link。

---

# 21. AI 私人结果

App 本地展示：

- 完整转写
- 摘要
- Topics
- Actions
- Speaker
- 参与者映射

这些默认不要上传云端。

---

# 22. 这场回顾

根据 AI 私人结果生成：

一份共享版回顾草稿。

例如：

```text
这场聊了什么

今天主要围绕 AI 智能硬件、供应链和出海展开……

主要话题
- AI 硬件产品定义
- 深圳供应链
- 海外渠道

值得记住的观点
...

行动项
...
```

默认只有主办方看到。

按钮：

`发布这场回顾`

点击后：

共享版保存云端。

---

# 23. 小程序查看回顾

主办方发布后：

参与者小程序：

`回顾`

可以看到：

共享版内容。

如果未发布：

显示：

```text
主办方还没有发布这场回顾。
```

---

# 24. 我参加过的

小程序：

`我的 → 我参加过的`

显示：

```text
AI 智能硬件 Coffee Chat
10月17日
已发布回顾

创业者读书会
10月3日
```

点击可再次进入 Session。

---

# 25. 本地 Embedding

实现 Transcript chunking。

Embedding：

由用户自己的百炼 Key 调用。

结果保存在 SQLite。

优先研究：

`sqlite-vec`

如果当前环境不稳定：

先实现：

- embedding 存 SQLite
- JS cosine similarity

必须保留 `VectorStore` abstraction。

---

# 26. 问倾盖如故

Mobile 增加：

# 问倾盖如故

可以问：

- 我之前在哪场聊过 AI 硬件？
- 有人提过日本市场吗？
- 上次王小明说了什么？
- 哪些记录聊过供应链？

流程：

```text
query
↓
query embedding
↓
local vector search
↓
top chunks
↓
LLM
↓
answer + sources
```

如果使用 LLM：

同样使用用户 BYOK。

---

# 27. 搜索引用来源

回答尽量显示：

```text
来源

AI 智能硬件 Coffee Chat
10月17日 21:13
王小明
```

点击来源：

跳转到对应 Transcript 时间位置。

如果第一版精确跳时间实现成本过高：

至少跳到对应 Session / Transcript chunk。

---

# 28. 不做支付

再次强调：

本阶段完全不要实现：

- PaymentProvider
- 微信支付
- 支付订单
- Mock Pay
- 余额
- 价格
- ¥9.9
- 订阅
- App 内购买

UI 也不要出现：

`¥9.9`

当前第一版宣传和使用逻辑：

> App 免费使用，AI 能力需要用户配置自己的阿里百炼 API Key。

等正式上架、微信 App 支付申请成功后再进入下一阶段。

---

# 29. Android Release

当前阶段必须能输出：

- debug APK
- release APK / AAB

Package Name 使用可配置正式值，例如：

`com.xixisys.pengtou`

如果实际正式包名后面调整：

不要散落硬编码。

准备：

- App icon placeholder
- splash
- app name：倾盖如故
- versioning

---

# 30. 应用宝上架准备

不需要替用户完成无法自动完成的账号审核。

但要准备：

`docs/APP_RELEASE_CHECKLIST.md`

列出：

- Android 包名
- 签名
- SHA256
- APK/AAB
- App icon
- Screenshots
- 隐私政策 URL
- 用户协议 URL
- 权限说明
- 麦克风用途
- 后台录音用途
- App 简介
- 版本说明

后续用户会上架应用宝。

---

# 31. 微信小程序上架准备

创建：

`docs/MINIAPP_RELEASE_CHECKLIST.md`

列出：

- AppID
- AppSecret
- 服务类目
- 隐私保护指引
- wx.login
- 域名
- request 合法域名
- 用户信息说明
- 审核测试路径
- 二维码场景

如果当前缺配置：

写入：

`docs/NEED_FROM_OWNER.md`

---

# 32. 隐私页面

项目中准备基础：

- 隐私政策
- 用户协议

至少覆盖：

- 麦克风权限
- 本地录音
- BYOK
- AI 第三方处理
- 小程序参与者资料
- 参与者可见范围
- 删除资料
- 保存资料复用
- 不做公开社交网络

先作为项目内 Markdown。

后续可发布成网页。

---

# 33. 删除能力

Mini Program：

用户至少可以：

- 修改自己的保存资料
- 删除保存资料

Backend 要支持。

Mobile：

用户可以：

- 删除本地 Session
- 删除录音
- 删除 AI 结果

避免只能增加不能删除。

---

# 34. 测试

Unit Tests：

- Session state
- participant visibility
- profile reuse
- chunking
- vector search
- speaker mapping
- AI provider abstraction

Integration Tests：

- create session
- join session
- profile save
- profile reuse
- participant list
- publish recap
- fetch recap

Mobile smoke：

```text
启动
开始录音
暂停
继续
完成
重启
看到记录仍存在
```

AI smoke：

```text
配置测试 Key
AI 整理
得到 transcript
得到 summary
得到 embedding
问倾盖如故搜索
```

---

# 35. Phase 顺序

严格优先按以下阶段推进。

## Phase 1 — Monorepo

- workspace
- mobile skeleton
- miniapp skeleton
- api skeleton
- shared packages
- lint/typecheck/build

## Phase 2 — Android Recording

- 真机录音
- 后台
- 锁屏
- 本地文件
- SQLite
- 恢复

## Phase 3 — Cloud Session

- create session
- QR
- miniapp join
- profile
- participants

## Phase 4 — App + 小程序联动

- Mobile 显示人数
- Mobile 显示参与者
- visibility

## Phase 5 — BYOK

- SecureStore
- 百炼
- test connection

## Phase 6 — Real AI

- ASR
- diarization
- summary
- topics/actions
- embedding

## Phase 7 — Speaker Mapping

- participants → speakers

## Phase 8 — Search

- local vector search
- 问倾盖如故
- sources

## Phase 9 — Shared Recap

- generate
- review
- publish
- miniapp read

## Phase 10 — Polish

- UI
- empty states
- errors
- privacy
- delete
- release docs

---

# 36. 第一阶段最终真实验收

必须能用两台手机跑下面流程。

## A 手机 — Android

安装倾盖如故。

打开。

点击：

`开始记录`

真正开始录音。

不用注册。

录音界面：

点击：

`让大家加入`

显示二维码。

---

## B 手机 — 微信

扫码。

打开倾盖如故小程序。

看到：

```text
10月17日 14:32 的记录
```

点击：

`加入这场`

填写：

```text
Peter

最近在做：
AI 智能硬件

想聊：
制造业 AI 落地
```

选择：

`保存，下次直接用`

加入。

---

## A 手机

无需手动刷新或轻刷新后看到：

```text
已有 1 人加入

Peter
AI 智能硬件
```

继续录音。

---

## A 手机

结束录音。

录音保存在手机。

如果未配置 API Key：

提示：

```text
配置阿里云百炼后，可以进行 AI 整理和搜索。
```

配置自己的 API Key。

点击：

`AI 整理本场`

得到：

- Transcript
- Speaker 1
- Summary
- Topics
- Actions
- Embeddings

---

## A 手机

把：

```text
Speaker 1
```

绑定：

```text
Peter
```

---

## A 手机

进入：

`问倾盖如故`

输入：

```text
Peter 刚刚聊了什么？
```

得到答案。

答案带来源。

---

## A 手机

查看：

`这场回顾`

确认后：

`发布这场回顾`

---

## B 手机

再次进入小程序。

在：

`回顾`

看到主办方发布的内容。

在：

`我的 → 我参加过的`

看到这场活动。

---

# 37. MVP 完成标准

不是：

- 页面画出来
- API 写出来
- Mock 跑起来

而是：

> Android 真机 + 微信小程序 + BYOK 百炼 + 本地搜索 + 回顾共享，这条真实链路可以完整跑通。

做到这里才叫：

# 倾盖如故 MVP v0.1 完成

---

# 38. 遇到缺少配置时

不要因为缺少以下配置就停止：

- 微信小程序 AppID
- AppSecret
- 正式合法域名
- 阿里百炼测试 Key
- 应用宝账号
- Android 正式签名

创建：

`docs/NEED_FROM_OWNER.md`

每项只写：

1. 需要什么
2. 为什么需要
3. 去哪里获取
4. 填在哪里
5. 当前哪部分还能继续开发

然后继续其它部分。

---

# 39. 开始执行

现在请：

1. 阅读 `AGENTS.md`
2. 检查当前仓库
3. 初始化 Monorepo
4. 跑通三个 skeleton
5. 确保 lint/typecheck/build
6. 立即进入 Android 真机录音
7. 按 Phase 顺序推进
8. 每完成一个 Phase 都实际运行验证
9. 持续更新 README 和 NEED_FROM_OWNER
10. 不要停留在方案讨论，直接把产品做出来
