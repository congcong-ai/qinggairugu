# 倾盖如故 · HyperFrames 产品介绍视频

新版独立于旧 OpenFilm 工程。采用用户选定的样音 A（Cherry）制作中文旁白，不沿用系统朗读。三个画幅约 46.14 秒，30 fps：

- `social/qinggairugu-douyin.mp4`：1080×1920，抖音竖屏。
- `xiaohongshu/qinggairugu-xiaohongshu.mp4`：1080×1440，小红书竖屏。
- `website/qinggairugu-website.mp4`：1920×1080，官网横屏。

叙事为：结果与方法悬念 → 现场交流痛点 → 本地录音 → AI 整理与本机搜索 → 组织者确认发布回顾 → 开源和下载。画面均为标注过的功能示意，不是实机操作录像。第三方服务名称局部隐去。

## 工程与复验

每个目录 `index.html` 为可编辑时间线；`DESIGN.md` 为品牌规范；`assets/voice-*.wav` 为六段原速旁白，镜头按真实时长加自然停顿排布。`narration/script.json` 为口播文案，`voice-samples/Cherry.wav` 为用户选定的样音。

进入对应目录运行：

```sh
npx -y hyperframes@0.8.221 check .
HYPERFRAMES_BROWSER_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' npx -y hyperframes@0.8.221 render --workers 1 --quality standard --output 产品介绍.mp4
```

本机字体使用 PingFang 与宋体，跨系统需另行提供合法中文字体。无需 Docker，不在工程中保存任何服务凭据。

## 验收边界

三个画幅均执行完整 HyperFrames 检查。转场采用 0.55 秒叠化，转场区间的重叠为有意设计。样音 A 已获用户选择；完整旁白听感待用户试听，文件生成、解码和响度不代替自然度验收。未发布到社媒，未部署官网。

## 建议配文

聊过的重点，过几天也能找回原文。倾盖如故，把每一次见面留下来。本地录音、AI 整理、话题搜索，让线下交流留下一份可回看的记忆。AI 需自备服务 Key，调用费用自理。官网了解与下载：https://qgrg.bebackpacker.com

技术验收完成：三版 MP4 均含 H.264 视频与 AAC 音轨，约 46.2 秒；完整解码无错误。混音复测约 -15.9 LUFS、真峰值 -1.01 dBTP。详细参数见 技术验收.json。
