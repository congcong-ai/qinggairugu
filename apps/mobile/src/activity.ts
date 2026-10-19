// 同一进程内防止整理过程中删除录音或追加音频。
export const activeAIJobs = new Set<string>();
