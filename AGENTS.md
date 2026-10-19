# AGENTS.md

# 倾盖如故（QingGai）项目长期开发规则

> 本文件是项目长期有效的产品、架构、工程和交互约束。  
> Codex 在本仓库中执行任何任务前，都应先阅读并遵守本文件。  
> 当前产品名称：**倾盖如故**
>
> 拼音：QingGaiRuGu
>
> 推荐英文内部代号：`qinggai`（现有包名、数据库和存储键中的 `pengtou` 为兼容标识，保留以保护已有数据）

---

## 1. 产品定位

倾盖如故不是传统会议软件，不是活动报名平台，也不是陌生人社交平台。

它解决的是：

> **线下见面以后，谁来了、聊了什么、以后还能不能找回来。**

核心 slogan：

> **把每一次见面留下来。**

第一阶段主要场景：

- Coffee Chat
- 读书会
- 创业者交流
- AI 分享活动
- 小型沙龙
- 培训
- 商务会谈
- 客户拜访
- 猎头与候选人面谈
- 一对一交流

第一阶段的市场切入口优先是：

> **活动主办方 / 小型线下活动组织者**

但底层产品模型不能锁死在“活动”。

---

## 2. 最核心的数据模型：Session

所有现实中的一次交流统一建模为：

`Session`

不要把核心对象命名为：

- EventOnly
- MeetingOnly
- CoffeeChat
- ActivityRecording

一个 Session 可以是：

- 一场 Coffee Chat
- 一次客户会谈
- 一次培训
- 一次猎头面谈
- 一次读书会
- 两个人的一次聊天

正式活动只是 Session 的一种表现形式。

Session 可以拥有：

- 一段或多段录音
- 多个参与者
- AI 转写
- Speaker
- 摘要
- 话题
- 行动项
- 可发布的活动回顾

---

## 3. 第一阶段明确不做

不要开发：

- 个人微信聊天同步
- 微信数据库破解
- 微信群聊天抓取
- 通讯录读取
- 全平台陌生人搜索
- 附近的人
- 私聊
- 好友系统
- 社交 Feed
- 全局人脉网络
- CRM
- 企业微信
- 飞书
- 钉钉
- Web 用户后台
- 桌面客户端
- 票务
- 活动招募平台
- 小红书发布
- 小程序长时间录音
- 声纹长期身份识别
- HarmonyOS 原生版
- iOS 上架
- 多 AI 厂商适配
- 多组织复杂权限
- 微信支付
- 支付系统
- Mock Pay

除非用户后续明确改变范围。

---

## 4. 第一阶段商业模式

第一版只使用：

# BYOK — Bring Your Own Key

用户自己填写：

**阿里云百炼 / DashScope API Key**

第一版：

- 不接微信支付
- 不接支付宝
- 不接 Apple IAP
- 不做余额
- 不做会员
- 不做订单
- 不做充值
- 不做 Mock Pay

原因：

1. 先验证真实需求。
2. 先完成 Android 上架。
3. Android 获得正式应用市场链接后，再申请微信 App 支付。
4. 支付拿到后再做第二阶段。

BYOK 不是长期商业模式，只是 MVP 验证阶段方案。

---

## 5. 产品结构

Monorepo 中至少包含：

```text
qinggai/
├── apps/
│   ├── mobile/        # Android App，未来兼容 iOS
│   ├── miniapp/       # 微信小程序
│   └── api/           # 轻量后端
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

- pnpm
- pnpm workspace
- Turborepo
- TypeScript
- Git

---

## 6. Android App 技术栈

优先采用当前稳定版本：

- Expo
- React Native
- TypeScript
- Expo Router
- Expo Prebuild
- Expo Custom Dev Client
- expo-audio
- expo-file-system
- expo-sqlite
- expo-secure-store
- React Native Reanimated
- Zod

UI 可以使用：

- Tamagui

如果 Codex 验证当前版本存在重大兼容问题，可以换成熟方案，但必须记录原因。

不要只依赖 Expo Go。

原因：

未来会需要：

- 后台长时间录音
- 更完整 Android 原生能力
- 微信 OpenSDK
- 后续微信 App 支付
- 未来 iOS

---

## 7. 微信小程序技术栈

使用：

- Taro
- React
- TypeScript
- pnpm

Mini Program UI 不要求与 Mobile 共用组件。

可以共享：

- 类型
- contracts
- Zod schema
- business rules
- design tokens
- utils

但不要为了“代码复用”牺牲微信小程序原生体验。

---

## 8. Backend 技术栈

建议：

- Node.js
- TypeScript
- Hono
- PostgreSQL
- Drizzle ORM
- Zod
- OpenAPI
- Pino

不要引入 Redis，除非后续确有必要。

MVP 保持后端非常轻。

---

## 9. 本地优先原则

这是本产品最重要的技术原则之一。

### 长期保存在用户手机

以下数据优先保存在 App 本地：

- 原始录音
- 完整 Transcript
- Speaker 信息
- 私人 AI 摘要
- Topics
- Actions
- Embeddings
- 本地语义搜索索引
- 用户私人备注

使用：

`expo-sqlite`

数据库例如：

`pengtou.db`

---

## 10. 云端保存什么

服务器保存：

- Session 基本信息
- Session 创建者
- 微信小程序参与者身份
- 参与者填写的“关于我”
- Session 与参与者关系
- 参与者资料复用设置
- participant_visibility
- 主办方确认发布后的共享回顾

第一版服务器不要长期保存：

- 原始录音
- 完整私人 Transcript
- 私人 Embedding
- 私人备注
- 主办方完整 AI 私人分析

---

## 11. 音频处理原则

用户录音长期保存在自己的手机。

BYOK 模式下：

手机使用用户自己的阿里百炼 API Key 调用 AI 服务。

如果百炼接口要求上传音频：

- 可以临时上传到模型服务需要的位置
- 不经过倾盖如故服务器长期保存
- 不允许把用户 API Key 发送到倾盖如故服务器
- 不允许写入日志
- 不允许写入 Analytics
- 不允许进入 Crash Report

UI 文案应诚实：

> 录音原文件长期保存在你的设备。AI 整理时会临时发送给你配置的 AI 服务处理。

---

## 12. AI Provider

第一版只支持：

# 阿里云百炼 / DashScope

不要同时支持：

- OpenAI
- Gemini
- 腾讯
- DeepSeek
- 火山
- 其他厂商

但是代码必须存在 Provider abstraction。

例如：

```ts
interface AIProvider {
  transcribe(input: TranscribeInput): Promise<TranscribeResult>;
  summarize(input: SummarizeInput): Promise<SummarizeResult>;
  embed(input: EmbedInput): Promise<EmbedResult>;
}
```

第一版实现：

`BailianProvider`

未来再扩展。

---

## 13. AI 流程

一场 Session 的 AI 整理：

```text
Recording
↓
ASR
↓
Speaker Diarization
↓
Transcript Segments
↓
Summary
↓
Topics / Actions
↓
Chunking
↓
Embeddings
↓
Local Storage
```

目标能力：

- 转写
- 发言人区分
- 摘要
- 话题
- 行动项
- 本地语义搜索

---

## 14. API Key 保存

API Key 只能保存于：

- Android Keystore
- expo-secure-store

禁止：

- localStorage
- AsyncStorage 明文
- SQLite 明文
- 后端数据库
-日志
- Crash Report
- Analytics

设置页可以显示：

> 阿里云百炼 API Key 已配置

但不要重新完整显示 Key。

提供：

- 更换
- 删除
- 测试连接

---

## 15. 首页原则

App 是消费级产品。

首页不要像企业 SaaS。

不要：

- Dashboard
- 复杂 KPI
- 多栏表格
- 管理后台
- 大量企业蓝
- 复杂层级

打开 App 后，最重要的是：

# 开始记录

用户首次打开无需先注册。

可以直接开始本地录音。

---

## 16. Mobile 视觉原则

风格：

- 简洁
- 温暖
- 轻松
- 年轻但不幼稚
- 大留白
- 大字号
- 大触控区域
- 圆角
- 克制动画

文案生活化。

优先：

- 开始记录
- 让大家加入
- 加入这场
- 认识一下
- 关于我
- 都有谁
- 这场回顾
- 我参加过的

避免：

- 新建会议
- 参会人员管理
- 会议纪要管理
- 联系人管理
- CRM
- 工作台

---

## 17. 录音交互

用户点：

`开始记录`

立即：

1. 请求麦克风权限
2. 创建本地 Session
3. 开始录音
4. 不要求先填写标题

默认标题：

`10月17日 14:32 的记录`

必须认真处理：

- Android 后台录音
- 锁屏录音
- Foreground Service
- 音频中断
- App 崩溃
- 存储空间不足
- 定期 checkpoint
- 恢复机制

核心原则：

> **录音不能轻易丢。**

---

## 18. 临时 Session 与正式活动

用户不需要提前创建活动。

最轻路径：

```text
打开 App
↓
开始记录
↓
自动创建 Session
↓
录音
↓
点“让大家加入”
↓
生成对应二维码
```

二维码与录音通过同一个：

`session_id`

关联。

不要通过：

- 日期
- 时间
- 标题

猜测关联。

---

## 19. 提前创建活动

也支持用户提前：

`创建一场`

只填写少量信息：

- 名称
- 时间（可选）
- participant_visibility

创建后生成二维码。

现场进入该 Session：

`开始记录`

---

## 20. 微信小程序参与者流程

扫码后：

```text
进入 Session
↓
看到活动名称
↓
加入这场
↓
填写“认识一下 / 关于我”
↓
选择保存资料或仅本场使用
↓
查看“都有谁”
↓
以后查看“这场回顾”
```

不要要求：

- 手机号
- 邮箱
- 密码
- 网站注册

使用：

`wx.login`

建立小程序身份。

---

## 21. “关于我”而不是“名片”

禁止把参与者资料叫：

- 名片
- 商务名片
- 简历

推荐叫：

- 认识一下
- 关于我

字段：

### 尽量少的必填

- 名字 / 昵称
- 一句话介绍

### 可选

- 最近在搞什么
- 今天想聊什么
- 想认识什么样的人
- 可以找我聊什么
- 公司 / 组织
- 职业
- 城市
- 小红书等公开链接

要适用于：

- 商务
- 兴趣
- 读书会
- Coffee Chat
- 娱乐活动

---

## 22. 参与者资料复用

第一次填写：

用户可以选择：

- 保存，下次直接用
- 仅本场使用

保存代表：

> 下次参加使用倾盖如故的活动，可以快速复用。

不代表：

> 加入公开社交网络。

第二次扫码：

应至少显示一次确认：

```text
欢迎回来

王小明
最近在搞 AI 智能硬件

[ 就用这个加入 ]
[ 修改 ]
```

不要自动无感公开上一次信息。

---

## 23. 参与者可见范围

Session 字段：

```ts
participant_visibility:
  | "everyone"
  | "organizer_only"
```

Coffee Chat 可默认：

`everyone`

商务、猎头等可以：

`organizer_only`

如果：

`everyone`

参与者可以看到本场其他人的“关于我”。

如果：

`organizer_only`

参与者看不到其他人的资料。

第一版只做这两种。

---

## 24. 不做全局人脉搜索

第一版必须坚持：

参与者只能查看：

**本场 Session 中允许查看的人。**

不要开发：

- 搜全平台用户
- 搜其他活动参与者
- 推荐陌生人
- 私信陌生人

原因包括：

- 产品边界
- 主办方控制感
- 诈骗风险
- 骚扰风险
- 内容治理
- 社交平台监管成本

---

## 25. Speaker 匹配

AI 得到：

- Speaker 1
- Speaker 2
- Speaker 3

如果 Session 已有参与者：

主办方可以匹配：

```text
Speaker 1 → 王小明
Speaker 2 → Lisa
Speaker 3 → 陈远
Speaker 4 → 暂不确定
```

第一版：

不做长期声纹识别。

不保存声纹模板。

---

## 26. 私人内容与共享内容分开

### 私人层

主办方手机本地：

- 原始录音
- 完整转写
- Speaker
- AI 私人摘要
- Embedding
- 搜索
- 私人备注

### 共享层

云端：

- Session 信息
- 参与者资料
- 主办方确认后的“这场回顾”

---

## 27. 这场回顾

AI 完成后：

App 自动生成一份可共享回顾草稿。

内容可包括：

- 这场聊了什么
- 主要话题
- 有意思的观点
- 公开行动项
- 主办方补充

默认：

**不自动发布**

必须：

主办方查看后点击：

`发布这场回顾`

发布后：

微信小程序参与者可以查看。

---

## 28. 小程序结构

建议底部：

```text
这场
都有谁
回顾
我的
```

其中：

### 这场
Session 信息。

### 都有谁
本场参与者。

### 回顾
主办方发布后的共享内容。

### 我的
- 我的“关于我”
- 我参加过的活动

---

## 29. 小程序第一版不录音

不要开发：

- 小程序长时间录音
- 小程序 ASR
- 参与者自己的 AI 录音

理由：

主办方已经承担整场录音。

参与者真正需要的是：

- 都有谁
- 发生了什么
- 会后回顾

如参与者需要原始录音，可自行使用手机录音工具。

---

## 30. 本地数据库

使用：

`expo-sqlite`

至少包含：

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

必须正式做 migrations。

不要散落 `CREATE TABLE`。

---

## 31. 本地语义搜索

Embedding 结果存在本地。

优先研究：

- sqlite-vec

如果当前 Expo/Android 组合不稳定：

允许第一版：

- embedding 存 SQLite
- JS 做 cosine similarity

但必须抽象：

```ts
interface VectorStore {
  upsert(...)
  search(...)
  delete(...)
}
```

以后可切换实现。

---

## 32. 搜索产品体验

App 内可以有：

# 问倾盖如故

示例：

- 我之前在哪场聊过 AI 硬件？
- 有人提过日本市场吗？
- 上次王小明主要说了什么？
- 有哪些人聊过供应链？

只搜索：

**该设备上的私人历史记录。**

回答必须尽量展示来源：

- Session
- 时间
- Speaker / Person

---

## 33. 匿名 Mobile 用户

第一次启动：

不要强制登录。

生成：

- installation_id
- installation_secret

保存 SecureStore。

用户可以直接：

- 开始录音
- 创建本地 Session

需要云端二维码时：

可以由匿名 device identity 创建云端 Session。

第一版不要引入：

- 手机号注册
- 邮箱注册
- 密码
- 多设备账号

---

## 34. 小程序身份

使用：

`wx.login`

服务端换取用户身份。

第一版不强制手机号。

保存资料与小程序用户绑定。

---

## 35. 二维码

正式环境使用：

微信官方小程序码。

指向：

```text
/pages/session/index?sid=xxxx
```

如果尚未配置真实 AppID/AppSecret：

开发期间可以使用 debug QR / 普通二维码。

但不能因此阻塞主链路开发。

---

## 36. 设计 Tokens

建立：

`packages/design-tokens`

至少包括：

- colors
- typography
- spacing
- radius
- shadow
- motion

Mobile 与 Mini Program 共用语义 tokens，不强求共用组件。

---

## 37. 隐私原则

第一次录音：

明确提醒：

> 请确保现场人员知道并同意录音。

小程序填写资料时：

明确说明：

> 你填写的信息将按照本场活动设置展示给主办方和/或本场参与者。

保存资料：

明确说明：

> 保存后，下次参加使用倾盖如故的活动可以直接复用。

不要偷换为公开社交授权。

---

## 38. Analytics

第一版只收最少匿名事件，例如：

- app_open
- recording_started
- recording_finished
- session_created
- qr_opened
- participant_joined
- ai_process_started
- ai_process_completed
- recap_published
- semantic_search_used

禁止 Analytics 收集：

- 音频内容
- transcript 正文
- API Key
- 私人摘要正文
- 搜索问题正文

---

## 39. 工程质量

必须做到：

- TypeScript strict
- lint
- format
- typecheck
- unit tests
- migrations
- `.env.example`
- README
- 合理日志
- 错误恢复

不要因为是 MVP 就写无法维护的代码。

---

## 40. 开发原则

Codex 执行时：

1. 先读 AGENTS.md。
2. 再读 TASK.md。
3. 直接开发，不先写长 PRD。
4. 能自行判断的不要停下来问用户。
5. 缺第三方配置时先做其它部分。
6. 不用 Mock Pay，因为第一版没有支付。
7. AI 可以有 Mock Provider，仅用于开发自动测试；真实用户路径必须支持 BYOK。
8. 每完成阶段都实际运行。
9. Android 录音必须真机验证。
10. 小程序必须在微信开发者工具运行。
11. UI 不接受纯工程 Demo。
12. 优先当前稳定、维护活跃的依赖。
13. 引入依赖前检查官方文档和维护状态。
14. 不提交任何真实 Secret。
15. 不把用户 API Key 传给服务端。
16. 有冲突时，优先保证：录音安全、隐私边界、低操作门槛。

---

## 41. 未来阶段，仅预留不要实现

以后可能加入：

- 微信 App 支付
- ¥9.9 / 场 AI 整理
- 3 小时以内基础价格
- 超时计费
- iOS
- Apple IAP
- Web
- 多设备同步
- 企业微信
- 其他 AI Provider

当前不要提前开发这些能力。

仅保证架构未来可扩展即可。
