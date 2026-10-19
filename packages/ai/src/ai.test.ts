import { describe, it, expect, vi } from 'vitest';
import { BailianProvider } from './bailian';
import { chunkTranscript, cosineSimilarity } from './search';
import type { AIProvider, TranscriptSegment } from './index';
const segments: TranscriptSegment[] = [
  {
    id: 'a',
    speakerId: 'speaker-1',
    startMs: 0,
    endMs: 1000,
    text: '最近在做 AI 硬件。',
  },
  {
    id: 'b',
    speakerId: 'speaker-2',
    startMs: 1000,
    endMs: 2000,
    text: '我主要做深圳供应链。',
  },
];
describe('本地搜索', () => {
  it('分块保留说话人、来源时间和所有文字', () => {
    const chunks = chunkTranscript(segments, 6);
    expect(chunks.map((c) => c.text).join('')).toBe(
      segments.map((s) => s.text).join(''),
    );
    expect(chunks.every((c) => c.text.length <= 6)).toBe(true);
    expect(chunks.at(-1)?.speakerId).toBe('speaker-2');
    expect(chunks.at(-1)?.startMs).toBe(1000);
  });
  it('余弦检索正确处理零向量和维度异常', () => {
    expect(cosineSimilarity([1, 0], [1, 0])).toBe(1);
    expect(cosineSimilarity([1, 0], [0, 1])).toBe(0);
    expect(cosineSimilarity([0, 0], [1, 0])).toBe(0);
    expect(() => cosineSimilarity([1], [1, 0])).toThrow();
    expect(() => cosineSimilarity([NaN], [1])).toThrow();
  });
});
describe('百炼 Provider 契约', () => {
  it('提交真实接口格式，启用单声道发言人区分', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        Response.json({ output: { task_id: 'task', task_status: 'PENDING' } }),
      );
    const provider: AIProvider = new BailianProvider('test-key', fetcher);
    expect(provider.embed).toBeTypeOf('function');
    const ai = provider as BailianProvider;
    expect(await ai.submitTranscription('oss://private/test.aac')).toBe('task');
    const request = fetcher.mock.calls[0]![1]!;
    expect(request.headers).toMatchObject({
      'X-DashScope-Async': 'enable',
      'X-DashScope-OssResourceResolve': 'enable',
    });
    expect(JSON.parse(request.body as string).parameters).toEqual({
      channel_id: [0],
      diarization_enabled: true,
    });
  });
  it('不把子任务失败当成功，不将服务端原始错误泄漏到 UI', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        output: {
          task_status: 'SUCCEEDED',
          results: [{ subtask_status: 'FAILED' }],
        },
      }),
    );
    await expect(
      new BailianProvider('secret', fetcher).pollTranscription('task'),
    ).rejects.toThrow('音频转写失败');
    fetcher.mockResolvedValue(
      new Response('secret private transcript', { status: 500 }),
    );
    await expect(
      new BailianProvider('secret', fetcher).testConnection(),
    ).rejects.toThrow('百炼调用失败（500）');
  });
  it('转写下载不附加 API Key，保留说话人与时间', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json({
          output: {
            task_status: 'SUCCEEDED',
            results: [
              {
                subtask_status: 'SUCCEEDED',
                transcription_url:
                  'https://result.oss-cn-beijing.aliyuncs.com/test.json',
              },
            ],
          },
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          transcripts: [
            {
              sentences: [
                { begin_time: 10, end_time: 200, text: '你好', speaker_id: 2 },
              ],
            },
          ],
        }),
      );
    const result = await new BailianProvider(
      'secret',
      fetcher,
    ).pollTranscription('task');
    expect(result?.[0]).toMatchObject({
      speakerId: 'speaker-2',
      startMs: 10,
      endMs: 200,
      text: '你好',
    });
    expect(fetcher.mock.calls[1]?.[1]?.headers).toBeUndefined();
  });
  it('拒绝外部 Key 发送地址和缺失的向量结果', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ data: [] }));
    const config = {
      baseUrl: 'https://example.com',
      asrModel: 'a',
      chatModel: 'c',
      embeddingModel: 'e',
      embeddingDimensions: 2,
    };
    expect(() => new BailianProvider('secret', fetcher, config)).toThrow();
    await expect(
      new BailianProvider('secret', fetcher).embed({ texts: ['你好'] }),
    ).rejects.toThrow('向量结果不完整');
  });
});
