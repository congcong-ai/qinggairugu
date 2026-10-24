// 同一进程内防止整理过程中删除录音或追加音频。
export const activeAIJobs = new Set<string>();

// 文件选择和复制期间，防止同场录音、整理、删除或更改引用。
export const activeAudioImports = new Set<string>();
