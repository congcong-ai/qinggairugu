import { afterEach, expect, it, vi } from 'vitest';
import { sessionQr } from './qr';

afterEach(() => vi.unstubAllGlobals());

it.each(['release', 'develop', 'trial'] as const)(
  '小程序码指向指定版本 %s，开发版不要求页面已发布',
  async (environment) => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ access_token: 'test-token' }))
      .mockResolvedValueOnce(
        new Response(new Uint8Array([137, 80, 78, 71]), {
          headers: { 'content-type': 'image/png' },
        }),
      );
    vi.stubGlobal('fetch', fetchMock);
    const id = 'cabe8de7-5bfa-4a75-9048-ab8c4865c9a3';
    const result = await sessionQr(
      id,
      'test-appid',
      'test-secret',
      environment,
    );
    const body = JSON.parse(fetchMock.mock.calls[1]?.[1].body as string);
    expect(body).toMatchObject({
      scene: id.replaceAll('-', ''),
      page: 'pages/session/index',
      env_version: environment,
      check_path: environment === 'release',
    });
    expect(result.mode).toBe('wechat');
    expect(result.imageDataUrl).toMatch(/^data:image\/png;base64,/);
  },
);
