import { it, expect } from 'vitest';
import { app } from './app';
it('API 健康检查和未知路由', async () => {
  expect(await (await app.request('/health')).json()).toEqual({
    status: 'ok',
    service: 'pengtou-api',
  });
  expect((await app.request('/missing')).status).toBe(404);
});
