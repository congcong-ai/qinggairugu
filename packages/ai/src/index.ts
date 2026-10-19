export interface TranscriptSegment {
  id: string;
  speakerId: string;
  startMs: number;
  endMs: number;
  text: string;
}
export interface AIProvider {
  transcribe(input: {
    audioUri: string;
    signal?: AbortSignal;
  }): Promise<{ segments: TranscriptSegment[] }>;
  summarize(input: {
    segments: TranscriptSegment[];
    signal?: AbortSignal;
  }): Promise<{ summary: string; topics: string[]; actions: string[] }>;
  embed(input: { texts: string[]; signal?: AbortSignal }): Promise<number[][]>;
}
export interface VectorStore {
  upsert(
    chunks: { id: string; sessionId: string; text: string; vector: number[] }[],
  ): Promise<void>;
  search(
    vector: number[],
    limit: number,
  ): Promise<{ id: string; sessionId: string; text: string; score: number }[]>;
  delete(sessionId: string): Promise<void>;
}
export { BailianProvider, TranscriptionTaskFailed } from './bailian';
export { bailianConfig } from './config';
export { chunkTranscript, cosineSimilarity } from './search';
