import { createWebsiteApp } from './website';
import { connectDatabase } from '@pengtou/database';
import { createCloudApp } from './cloud';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { serve } from '@hono/node-server';
import pino from 'pino';
import { app } from './app';
import { z } from 'zod';
const envFile = resolve(process.cwd(), '../../.env');
if (existsSync(envFile)) process.loadEnvFile(envFile);
const database = process.env.DATABASE_URL
  ? connectDatabase(process.env.DATABASE_URL)
  : null;
if (database)
  app.route(
    '/',
    createCloudApp(database.db, {
      allowDevAuth:
        process.env.NODE_ENV !== 'production' &&
        process.env.ALLOW_DEV_AUTH === 'true',
      wechatAppId: process.env.WECHAT_APP_ID,
      wechatOpenPlatformId: process.env.WECHAT_OPEN_PLATFORM_ID,
      wechatMobileAppId: process.env.WECHAT_MOBILE_APP_ID,
      wechatMobileAppSecret: process.env.WECHAT_MOBILE_APP_SECRET,
      wechatAppSecret: process.env.WECHAT_APP_SECRET,
      wechatMiniappEnv: z
        .enum(['release', 'trial', 'develop'])
        .default('release')
        .parse(process.env.WECHAT_MINIAPP_ENV),
    }),
  );
const runtime = z
  .object({
    PORT: z.coerce.number().int().min(1).max(65535).default(9001),
    HOST: z.string().default('0.0.0.0'),
  })
  .parse(process.env);
if (process.env.NODE_ENV === 'production') {
  z.object({
    DATABASE_URL: z.url(),
    WECHAT_APP_ID: z.literal('wx066bf055f6b9d415'),
    WECHAT_APP_SECRET: z.string().min(1),
    ALLOW_DEV_AUTH: z.literal('false'),
    HOST: z.literal('127.0.0.1'),
  }).parse(process.env);
}
app.get('/health/db', async (c) => {
  if (!database) return c.json({ status: 'unavailable' }, 503);
  try {
    await database.sql`SELECT organizer_user_id,archived_at FROM sessions LIMIT 1`;
    return c.json({ status: 'ok' });
  } catch {
    return c.json({ status: 'unavailable' }, 503);
  }
});
app.route('/', createWebsiteApp());
const logger = pino({
  redact: [
    'apiKey',
    'authorization',
    'installationSecret',
    'req.headers.authorization',
  ],
});
const server = serve(
  { fetch: app.fetch, port: runtime.PORT, hostname: runtime.HOST },
  () => logger.info({ port: runtime.PORT }, '倾盖如故 API 已启动'),
);
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () =>
    server.close(() => {
      void (database?.sql.end() ?? Promise.resolve()).finally(() =>
        process.exit(0),
      );
    }),
  );
