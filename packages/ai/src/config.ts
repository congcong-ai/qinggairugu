// 仅配置阿里云百炼北京地域。模型 ID 集中管理，业务代码不依赖特定版本。
export const bailianConfig = {
  baseUrl: 'https://dashscope.aliyuncs.com',
  asrModel: 'fun-asr',
  chatModel: 'qwen-plus',
  embeddingModel: 'text-embedding-v4',
  embeddingDimensions: 1024,
} as const;
