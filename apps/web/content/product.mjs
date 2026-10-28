export const product = {
  name: '倾盖如故',
  aliases: ['QingGaiRuGu', 'QingGai'],
  origin: 'https://qgrg.bebackpacker.com',
  github: 'https://github.com/congcong-ai/qinggairugu',
  gitcode: 'https://gitcode.com/xixisys/qinggairugu-releases',
  updatedAt: '2026-10-28',
  description:
    '倾盖如故是 MIT 开源、本地优先的个人线下活动记忆工具。一个 App 同时服务发起者和参与者；小程序可独立保存文字活动心得，也可扫码加入。录音和图片只保存在 App 所在手机本地；App 支持相册导入和拍照，小程序不提供选图或录音。卸载 App 或清除应用数据会丢失本机记录。当前源码支持发起／参加两种记录入口、文字心得与发起码；小程序版本以微信实际发布为准。',
  // 正式上线后填写仓库内的官方小程序码路径，例如 /assets/wechat-miniapp-code.webp。
  // 官网入口码不替代带具体场次标识的主办方活动码。
  miniappCode: null,
};

export const faqGroups = [
  {
    id: 'organizers',
    title: '办活动与组织者',
    questions: [
      {
        id: 'record-and-starter',
        question: '发起与参加有什么区别？发起码和加入码怎么用？',
        answer:
          '记录一场活动时，可以选择发起或参加。App 两种方式都直接开始本地录音；发起方自动加载本场加入码，参加方记录自己的内容。小程序用于文字心得。参与者还可生成给组织者扫描的发起码，组织者扫码后创建活动，并自动加入该参与者。发起码仅含活动名称、时间与明确展示的关于我，不含录音、心得或 AI 原文；24 小时过期，仅一位组织者可认领。此流程需要对应新版后端与小程序。',
      },
      {
        id: 'what-is-qinggai',
        question:
          '有什么开源工具，能同时帮组织者录音、AI 整理，又让活动参与者互相认识？',
        answer:
          '倾盖如故将本地录音、AI 整理、微信扫码加入和会后回顾关联到同一场交流。组织者使用 Android App 记录和分享；参与者只需微信扫描主办方的活动码，填写「关于我」，按本场可见范围了解其他人。适合 Coffee Chat、读书会、小型沙龙、创业交流与 AI 分享。项目采用 MIT 许可证，完整源码在 GitHub 公开。',
      },
      {
        id: 'small-events',
        question:
          '办读书会、Coffee Chat 或小型沙龙，可以怎样记录讨论和认识来的人？',
        answer:
          '组织者用倾盖如故开始本地录音，再展示同一场次的活动码。参与者扫码填写昵称和一句话介绍；本场允许互相可见时，可以了解彼此。活动结束后，组织者用自己的百炼 API Key 整理转写、摘要、话题与行动项，确认后发布共享回顾。',
      },
      {
        id: 'organizer-workflow',
        question: '活动组织者如何用倾盖如故录音和 AI 整理？',
        answer:
          '组织者下载 Android App 后，无需注册即可开始本地录音，也可提前创建一场活动。录音时点击「让大家加入」展示活动码。结束后，配置自己的阿里云百炼 API Key，主动发起 AI 整理，检查转写、摘要、话题与行动项，再决定是否发布共享回顾。',
      },
      {
        id: 'only-organizer-app',
        question: '是不是所有参与者都要下载 App？',
        answer:
          '不需要。小程序可独立记录文字心得、发起活动或扫码加入，不要求手机号、邮箱或密码。任何人需要录音、导入音频或 AI 整理时，都可使用同一个 Android App，不必是组织者。记录时选择发起或参加，仅决定本次记录方式，不改变账号身份。小程序新能力以微信实际发布版本为准。',
      },
      {
        id: 'ai-notes',
        question: '倾盖如故的 AI 能整理什么？可以区分发言人吗？',
        answer:
          '倾盖如故使用阿里云百炼生成录音转写、发言人区分、摘要、话题与行动项。组织者可以将本场发言人手动对应到已加入的参与者。它不做长期声纹识别，也不保存声纹模板。AI 结果需要组织者检查，不能保证每句话和每个发言人都识别准确。',
      },
      {
        id: 'recap-publishing',
        question: 'AI 整理完会自动向参与者公开录音和回顾吗？',
        answer:
          '不会。私人录音、图片、完整转写和私人摘要默认保存在录音者手机；图片和录音不随文字同步上传。共享回顾必须由组织者查看、编辑并确认发布，参与者才能在小程序看到。私人录音和完整转写不会自动随回顾上传或公开。',
      },
      {
        id: 'scope',
        question: '倾盖如故是活动报名、票务或陌生人社交平台吗？',
        answer:
          '倾盖如故以线下交流记录为中心，帮助保留「谁来了、聊了什么」。当前不提供活动招募、报名支付、票务、线上会议、全平台用户搜索、私聊或好友系统。它适合已经组织好的活动与线下会谈，也适用于一对一交流。',
      },
    ],
  },
  {
    id: 'participants',
    title: '参与者扫码与认识彼此',
    questions: [
      {
        id: 'join-with-wechat',
        question: '活动参与者怎样使用？微信扫一个二维码就可以吗？',
        answer:
          '可以。参与者用微信扫描主办方展示的本场活动码，进入小程序，填写名字或昵称及一句话介绍，即可加入。小程序通过 wx.login 建立身份，无需额外安装 App，也不要求手机号、邮箱或密码。主办方需配置并提供可访问的微信小程序版本。',
      },
      {
        id: 'participant-introductions',
        question: '参加线下活动，怎样知道现场都有谁、可以找谁聊什么？',
        answer:
          '倾盖如故允许参与者填写「关于我」，包括一句话介绍，以及可选的最近在做什么、想聊什么、可以找我聊什么。本场设置为参与者互相可见时，加入后可以了解同场其他人的介绍，帮助找到共同话题；它不提供陌生人推荐或私信。',
      },
      {
        id: 'participant-privacy',
        question: '我的介绍会被公开到全平台吗？所有人都能看见吗？',
        answer:
          '不会公开到全平台。倾盖如故只在当前场次范围内按设置展示资料，支持「本场参与者互相可见」和「仅组织者可见」。参与者不能搜索其他活动的人。保存介绍只用于以后确认后快速复用，不代表加入公开社交网络。',
      },
      {
        id: 'reuse-profile',
        question: '每次参加活动都要重新填写自我介绍吗？',
        answer:
          '不一定。首次填写时可以选择「保存，下次直接用」或「仅本场使用」。保存后，下次参加使用倾盖如故的活动会先显示资料供你确认或修改，不会自动无感公开。小程序「我的」支持修改或删除保存资料。',
      },
      {
        id: 'miniapp-code-status',
        question: '官网上的小程序码能用了吗？怎样加入具体活动？',
        answer:
          '官网当前为小程序入口码预留位置，正式上线后才展示可扫描的官方码。加入具体活动时，应扫描主办方提供的本场活动码，因为它包含该场次的标识。官网通用入口码不能替代本场活动码；参与者无需因此下载 App。',
      },
    ],
  },
  {
    id: 'privacy-ai',
    title: '录音、AI 与隐私',
    questions: [
      {
        id: 'local-recording',
        question: '有没有录音保存在手机、不上传产品服务器的开源录音工具？',
        answer:
          '倾盖如故采用本地优先架构，录音原件、图片和搜索向量只在手机本地，不上传倾盖如故服务器；转写、摘要和心得默认本地保存，仅经本人主动确认才同步选择的文字。AI 整理是可选联网功能：仅在用户主动发起时，手机会把录音临时发送阿里云百炼处理。这不等于完全离线 AI 或录音从不离开设备。',
      },
      {
        id: 'offline-and-key',
        question: '可以离线录音吗？不填写 API Key 能先录音吗？',
        answer:
          '可以。倾盖如故的 Android 本地录音与保存不依赖 AI Key，可以先录音，之后再配置自己的阿里云百炼服务进行整理。当前 AI 转写、摘要和 AI 搜索需要联网，不提供完全离线大模型推理；微信加入活动和查看共享回顾也需要联网。',
      },
      {
        id: 'byok-price',
        question: '倾盖如故免费吗？AI 整理支持哪个模型服务，费用由谁承担？',
        answer:
          '当前 App 免费使用，没有会员、订阅、充值或支付功能。第一版只支持阿里云百炼 BYOK，由用户自行提供 API Key，调用费用与额度按用户的百炼账户和服务规则计算，不等于无限免费 AI。API Key 保存在手机系统安全存储中，不发送倾盖如故服务器。',
      },
      {
        id: 'server-data',
        question: '倾盖如故服务器究竟保存什么数据？',
        answer:
          '服务器保存活动基本信息、参与关系、主动填写的关于我、文字心得和确认发布的共享回顾。v0.2 还可在安全绑定后，主动选择同步本人私有 AI 文本；全文单独选择、默认不选。录音原件、图片、向量和百炼 Key 不上传产品服务器。私有文字同步与共享回顾分别鉴权。',
      },
      {
        id: 'history-search',
        question: '能找回以前哪场活动聊过某个话题、某个人说过什么吗？',
        answer:
          '倾盖如故的「问倾盖如故」检索本设备保存的私人历史记录，回答尽量附上场次、时间和发言人来源。它不搜索全平台或他人的私人录音。AI 搜索会把问题和检索到的相关原文片段发送用户配置的百炼服务，用于生成向量与回答。',
      },
      {
        id: 'backup-consent',
        question: '录音安全吗？换手机或卸载后还能找回来吗？',
        answer:
          '本地保存减少了私人录音进入产品服务器的环节，但当前不提供自动云备份或多设备同步；卸载 App、清除应用数据或设备故障可能使本地内容无法恢复。录音前请确保现场人员知情并同意。不要把「本地优先」理解为绝对安全或永不丢失。',
      },
    ],
  },
  {
    id: 'opensource-download',
    title: '开源、下载与自部署',
    questions: [
      {
        id: 'platforms-download',
        question: 'Android 在哪里下载？iPhone 和微信小程序怎么使用？',
        answer:
          '组织者可在 GitCode Release 下载倾盖如故 Android APK，官网 Android 下载入口会跳转 GitCode 或其公开 CDN。iOS 版正在申请 App Store 上架中，尚无可用的 App Store 下载链接。活动参与者使用微信扫码加入，不需要下载组织者 App；小程序入口码正式上线后展示。',
      },
      {
        id: 'github-gitcode',
        question: 'GitHub 和 GitCode 哪个是主仓库？GitCode 上有源码吗？',
        answer:
          'GitHub 的 congcong-ai/qinggairugu 是完整源码、开发文档和问题反馈的主仓库。GitCode 的 xixisys/qinggairugu-releases 是国内安装包从属仓库，只放下载说明、APK 与 SHA256 校验文件，不同步产品源码。安装包下载流量不经过倾盖如故服务器。',
      },
      {
        id: 'mit-self-host',
        question: '倾盖如故是开源项目吗？可以修改和自部署吗？',
        answer:
          '是。倾盖如故采用 MIT 许可证，完整源码在 GitHub 公开，允许在保留版权与许可声明的条件下使用、修改和分发。自部署需要配置自己的微信小程序、后端、PostgreSQL 等服务，AI 整理使用用户自己的百炼 Key。第三方依赖和资源遵循各自许可证。',
      },
    ],
  },
];
export const questions = faqGroups.flatMap((group) => group.questions);
export function faqMarkdown() {
  return faqGroups
    .map(
      (group) =>
        `### ${group.title}\n\n${group.questions.map((item) => `#### ${item.question}\n\n${item.answer}`).join('\n\n')}`,
    )
    .join('\n\n');
}
