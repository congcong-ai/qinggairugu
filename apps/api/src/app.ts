import { openapi } from './openapi';
import { Hono } from 'hono';
export const app = new Hono();
app.get('/health', (c) => c.json({ status: 'ok', service: 'pengtou-api' }));
app.get('/openapi.json', (c) => c.json(openapi));
app.notFound((c) => c.json({ error: '资源不存在' }, 404));
app.onError((_error, c) => c.json({ error: '服务暂时不可用' }, 500));
