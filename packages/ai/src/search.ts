import type { TranscriptSegment } from './index';
export function chunkTranscript(segments: TranscriptSegment[], maxChars = 800) {
  if (maxChars < 1) throw new Error('片段长度必须大于零');
  const chunks: { text: string; startMs: number; speakerId: string }[] = [];
  for (const segment of segments) {
    for (let offset = 0; offset < segment.text.length; offset += maxChars) {
      const text = segment.text.slice(offset, offset + maxChars);
      const previous = chunks.at(-1);
      if (
        previous &&
        previous.speakerId === segment.speakerId &&
        previous.text.length + text.length + 1 <= maxChars
      )
        previous.text += '\n' + text;
      else
        chunks.push({
          text,
          startMs: segment.startMs,
          speakerId: segment.speakerId,
        });
    }
  }
  return chunks;
}
export function cosineSimilarity(a: number[], b: number[]) {
  if (a.length !== b.length || a.length === 0)
    throw new Error('向量维度不匹配');
  let dot = 0,
    aa = 0,
    bb = 0;
  for (let i = 0; i < a.length; i++) {
    const x = a[i]!,
      y = b[i]!;
    if (!Number.isFinite(x) || !Number.isFinite(y))
      throw new Error('向量包含无效数值');
    dot += x * y;
    aa += x * x;
    bb += y * y;
  }
  return aa === 0 || bb === 0 ? 0 : dot / Math.sqrt(aa * bb);
}
