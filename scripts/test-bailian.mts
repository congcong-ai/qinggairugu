import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { BailianProvider, bailianConfig } from '../packages/ai/src/index';

const envFile = fileURLToPath(new URL('../.env', import.meta.url));
if (existsSync(envFile)) process.loadEnvFile(envFile);
const key = process.env.DASHSCOPE_API_KEY?.trim();
if (!key) {
  console.error(
    '请先在根目录 .env 填写 DASHSCOPE_API_KEY。此命令仅用于本机验证，不会向倾盖如故后端发送 Key。',
  );
  process.exitCode = 1;
} else {
  try {
    const ai = new BailianProvider(key);
    await ai.testConnection();
    console.log('百炼连接成功（北京地域）');
    // 使用公开的测试句子，不读取用户录音、私人摘要或数据库。
    const text = '我们今天讨论了读书会，下周六继续交流。';
    const vectors = await ai.embed({ texts: [text] });
    if (
      vectors.length !== 1 ||
      vectors[0]?.length !== bailianConfig.embeddingDimensions
    )
      throw new Error('向量维度不符');
    console.log(`向量模型验证通过，维度 ${vectors[0].length}`);
    const summary = await ai.summarize({
      segments: [
        {
          id: 'local-check',
          speakerId: 'speaker-1',
          startMs: 0,
          endMs: 3000,
          text,
        },
      ],
    });
    if (!summary.summary.trim()) throw new Error('摘要为空');
    console.log('摘要结构验证通过。未执行音频转写；仍需在手机验证实际录音。');
  } catch {
    // 不打印供应商原始响应、请求对象或密钥。
    console.error(
      '百炼验证未完成，请检查北京地域 Key、模型开通状态、额度与网络。',
    );
    process.exitCode = 1;
  }
}
