# 倾盖如故 Android 安装包

**从初见，到如故。**

倾盖如故是一款本地优先的线下交流记录工具：组织者使用 Android App 录音、整理和分享回顾，参与者通过微信小程序扫码加入、填写「关于我」，按本场设置认识彼此。

- [下载 Android 安装包](https://gitcode.com/xixisys/qinggairugu-releases/releases)
- [GitHub 源码主仓库](https://github.com/congcong-ai/qinggairugu)
- [产品介绍与常见问答](https://github.com/congcong-ai/qinggairugu#readme)
- [隐私说明](https://github.com/congcong-ai/qinggairugu/blob/main/docs/PRIVACY_POLICY.md)

## 两个仓库如何分工？

GitHub 的 `congcong-ai/qinggairugu` 是完整源码、开发文档和问题反馈的主仓库。项目采用 [MIT 许可证](https://github.com/congcong-ai/qinggairugu/blob/main/LICENSE)。

GitCode 的 `xixisys/qinggairugu-releases` 是面向国内用户的安装包发布仓库，只提供 Android APK、SHA256 校验文件和下载说明，不同步产品源码，也不接收用户录音、转写或参与者资料。

## 如何安装和校验？

在 Release 中下载 `qinggai-版本号-release.apk`，在 Android 手机打开安装。同一 Release 提供同名 `.apk.sha256` 文件，可用于核对下载文件的完整性：

```bash
shasum -a 256 qinggai-版本号-release.apk
```

APK 为独立安装包，使用时不需要 Expo Go、Metro 或开发电脑。录音无需注册；AI 整理需要在 App 中配置自己的阿里云百炼 API Key。iOS 版正在申请 App Store 上架中。

## 录音会上传吗？

录音原文件、完整转写与私人摘要长期保存在用户手机，不上传倾盖如故服务器。用户主动使用 AI 整理时，App 会将录音临时发送至用户配置的阿里云百炼处理；使用 AI 搜索时，问题与检索到的相关原文片段也会发送百炼。共享活动信息、参与者资料和主办方确认发布的回顾保存在倾盖如故服务器。

请确保现场人员知情并同意录音。完整的数据处理说明见主仓库隐私文档。
