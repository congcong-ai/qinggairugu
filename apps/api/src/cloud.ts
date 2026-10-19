import { sessionQr, type MiniappEnv } from './qr';
import {
  randomBytes,
  createHash,
  timingSafeEqual,
  randomUUID,
} from 'node:crypto';
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { z } from 'zod';
import {
  createSessionSchema,
  updateSessionSchema,
  joinSessionSchema,
  publishRecapSchema,
  profileSchema,
} from '@pengtou/contracts';
import { type Database, schema, eq, and, gt, desc } from '@pengtou/database';
const hash = (value: string) =>
  createHash('sha256').update(value).digest('hex');
type Actor = { kind: 'device'; id: string } | { kind: 'user'; id: string };
interface Config {
  allowDevAuth: boolean;
  wechatAppId?: string;
  wechatAppSecret?: string;
  wechatMiniappEnv?: MiniappEnv;
}
export function createCloudApp(db: Database, config: Config) {
  const app = new Hono<{ Variables: { actor: Actor | null } }>();
  app.use(
    '*',
    bodyLimit({
      maxSize: 128 * 1024,
      onError: (c) => c.json({ error: '请求内容过大' }, 413),
    }),
  );
  app.use('*', async (c, next) => {
    let actor: Actor | null = null;
    const deviceId = c.req.header('x-installation-id');
    const secret = c.req.header('x-installation-secret');
    const token = c.req.header('authorization')?.replace(/^Bearer /, '');
    if (
      deviceId &&
      secret &&
      z.uuid().safeParse(deviceId).success &&
      secret.length <= 256
    ) {
      const [device] = await db
        .select()
        .from(schema.installations)
        .where(eq(schema.installations.id, deviceId));
      if (
        device &&
        timingSafeEqual(
          Buffer.from(device.secretHash, 'hex'),
          Buffer.from(hash(secret), 'hex'),
        )
      )
        actor = { kind: 'device', id: device.id };
    } else if (token && token.length <= 256) {
      const [found] = await db
        .select()
        .from(schema.tokens)
        .where(
          and(
            eq(schema.tokens.hash, hash(token)),
            gt(schema.tokens.expiresAt, new Date()),
          ),
        );
      if (found) actor = { kind: 'user', id: found.userId };
    }
    c.set('actor', actor);
    await next();
  });
  app.post('/installations', async (c) => {
    const input = z
      .object({ id: z.uuid(), secret: z.string().regex(/^[a-f0-9]{64}$/) })
      .strict()
      .parse(await c.req.json());
    const secretHash = hash(input.secret);
    await db
      .insert(schema.installations)
      .values({ id: input.id, secretHash })
      .onConflictDoNothing();
    const [row] = await db
      .select()
      .from(schema.installations)
      .where(eq(schema.installations.id, input.id));
    if (row?.secretHash !== secretHash)
      return c.json({ error: '设备身份验证失败' }, 403);
    return c.json({ id: input.id }, 201);
  });
  app.post('/auth/wechat', async (c) => {
    const input = z
      .object({ code: z.string().min(1).max(256) })
      .strict()
      .parse(await c.req.json());
    let openid: string;
    if (config.allowDevAuth && input.code.startsWith('dev:'))
      openid = input.code;
    else {
      if (!config.wechatAppId || !config.wechatAppSecret)
        return c.json({ error: '微信身份服务尚未配置' }, 503);
      const url = new URL('https://api.weixin.qq.com/sns/jscode2session');
      url.search = new URLSearchParams({
        appid: config.wechatAppId,
        secret: config.wechatAppSecret,
        js_code: input.code,
        grant_type: 'authorization_code',
      }).toString();
      const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
      const result = z
        .object({
          openid: z.string().optional(),
          errcode: z.number().optional(),
        })
        .parse(await response.json());
      if (!response.ok || result.errcode || !result.openid)
        return c.json({ error: '微信登录失败，请重试' }, 401);
      openid = result.openid;
    }
    const [user] = await db
      .insert(schema.users)
      .values({ id: randomUUID(), openid })
      .onConflictDoUpdate({ target: schema.users.openid, set: { openid } })
      .returning();
    if (!user) throw new Error('用户创建失败');
    const token = randomBytes(32).toString('hex');
    await db.insert(schema.tokens).values({
      hash: hash(token),
      userId: user.id,
      expiresAt: new Date(Date.now() + 7 * 86400000),
    });
    return c.json({ token, userId: user.id });
  });
  app.post('/sessions', async (c) => {
    const actor = c.get('actor');
    if (actor?.kind !== 'device')
      return c.json({ error: '需要主办方设备身份' }, 401);
    const input = createSessionSchema.parse(await c.req.json());
    await db
      .insert(schema.sessions)
      .values({
        ...input,
        organizerId: actor.id,
        startsAt: input.startsAt ? new Date(input.startsAt) : null,
      })
      .onConflictDoNothing();
    const [row] = await db
      .select()
      .from(schema.sessions)
      .where(eq(schema.sessions.id, input.id));
    if (!row || row.organizerId !== actor.id)
      return c.json({ error: '无法创建此记录' }, 409);
    return c.json(row, 201);
  });
  app.get('/me/profile', async (c) => {
    const actor = c.get('actor');
    if (actor?.kind !== 'user') return c.json({ error: '请先加入身份' }, 401);
    const [user] = await db
      .select({ profile: schema.users.profile })
      .from(schema.users)
      .where(eq(schema.users.id, actor.id));
    return c.json(user ?? { profile: null });
  });
  app.put('/me/profile', async (c) => {
    const actor = c.get('actor');
    if (actor?.kind !== 'user') return c.json({ error: '请先登录' }, 401);
    const profile = profileSchema.parse(await c.req.json());
    await db
      .update(schema.users)
      .set({ profile })
      .where(eq(schema.users.id, actor.id));
    return c.json({ profile });
  });
  app.delete('/me/profile', async (c) => {
    const actor = c.get('actor');
    if (actor?.kind !== 'user') return c.json({ error: '请先登录' }, 401);
    await db
      .update(schema.users)
      .set({ profile: null })
      .where(eq(schema.users.id, actor.id));
    return c.json({ deleted: true });
  });
  app.get('/me/sessions', async (c) => {
    const actor = c.get('actor');
    if (actor?.kind !== 'user') return c.json({ error: '请先登录' }, 401);
    const rows = await db
      .select({ session: schema.sessions, recap: schema.recaps.publishedAt })
      .from(schema.participants)
      .innerJoin(
        schema.sessions,
        eq(schema.participants.sessionId, schema.sessions.id),
      )
      .leftJoin(schema.recaps, eq(schema.recaps.sessionId, schema.sessions.id))
      .where(eq(schema.participants.userId, actor.id))
      .orderBy(desc(schema.sessions.createdAt));
    return c.json(
      rows.map((r) => ({
        id: r.session.id,
        title: r.session.title,
        createdAt: r.session.createdAt,
        recapPublishedAt: r.recap,
      })),
    );
  });
  app.use('/sessions/:id/*', async (c, next) => {
    if (!z.uuid().safeParse(c.req.param('id')).success)
      return c.json({ error: '无效的记录编号' }, 400);
    await next();
  });
  app.get('/sessions/:id', async (c) => {
    const id = z.uuid().parse(c.req.param('id'));
    const [row] = await db
      .select()
      .from(schema.sessions)
      .where(eq(schema.sessions.id, id));
    if (!row) return c.json({ error: '这场不存在' }, 404);
    const people = await db
      .select({ userId: schema.participants.userId })
      .from(schema.participants)
      .where(eq(schema.participants.sessionId, id));
    return c.json({
      id: row.id,
      title: row.title,
      startsAt: row.startsAt,
      participantVisibility: row.participantVisibility,
      createdAt: row.createdAt,
      participantCount: people.length,
    });
  });
  app.patch('/sessions/:id', async (c) => {
    const id = z.uuid().parse(c.req.param('id'));
    const actor = c.get('actor');
    if (actor?.kind !== 'device')
      return c.json({ error: '仅主办方可修改' }, 403);
    const input = updateSessionSchema.parse(await c.req.json());
    const [row] = await db
      .update(schema.sessions)
      .set({
        title: input.title,
        participantVisibility: input.participantVisibility,
        startsAt:
          input.startsAt === undefined
            ? undefined
            : input.startsAt
              ? new Date(input.startsAt)
              : null,
      })
      .where(
        and(
          eq(schema.sessions.id, id),
          eq(schema.sessions.organizerId, actor.id),
        ),
      )
      .returning();
    return row ? c.json(row) : c.json({ error: '无权修改此记录' }, 403);
  });
  app.post('/sessions/:id/join', async (c) => {
    const id = z.uuid().parse(c.req.param('id'));
    const actor = c.get('actor');
    if (actor?.kind !== 'user') return c.json({ error: '请先微信登录' }, 401);
    const input = joinSessionSchema.parse(await c.req.json());
    const [session] = await db
      .select()
      .from(schema.sessions)
      .where(eq(schema.sessions.id, id));
    if (!session) return c.json({ error: '这场不存在' }, 404);
    await db.transaction(async (txn) => {
      await txn
        .insert(schema.participants)
        .values({ sessionId: id, userId: actor.id, profile: input.profile })
        .onConflictDoUpdate({
          target: [schema.participants.sessionId, schema.participants.userId],
          set: { profile: input.profile },
        });
      if (input.saveProfile)
        await txn
          .update(schema.users)
          .set({ profile: input.profile })
          .where(eq(schema.users.id, actor.id));
    });
    return c.json({ joined: true }, 201);
  });
  async function access(id: string, actor: Actor | null) {
    const [session] = await db
      .select()
      .from(schema.sessions)
      .where(eq(schema.sessions.id, id));
    if (!session) return { session, organizer: false, member: false };
    const organizer =
      actor?.kind === 'device' && actor.id === session.organizerId;
    const membership =
      actor?.kind === 'user'
        ? (
            await db
              .select()
              .from(schema.participants)
              .where(
                and(
                  eq(schema.participants.sessionId, id),
                  eq(schema.participants.userId, actor.id),
                ),
              )
          )[0]
        : null;
    return { session, organizer, member: !!membership };
  }
  app.get('/sessions/:id/participants', async (c) => {
    const id = z.uuid().parse(c.req.param('id'));
    const permission = await access(id, c.get('actor'));
    if (!permission.session) return c.json({ error: '这场不存在' }, 404);
    if (
      !permission.organizer &&
      !(
        permission.member &&
        permission.session.participantVisibility === 'everyone'
      )
    )
      return c.json({ error: '本场参与者资料仅对有权限的人展示' }, 403);
    const rows = await db
      .select({
        id: schema.participants.userId,
        profile: schema.participants.profile,
        joinedAt: schema.participants.joinedAt,
      })
      .from(schema.participants)
      .where(eq(schema.participants.sessionId, id));
    return c.json(rows);
  });
  app.post('/sessions/:id/recap', async (c) => {
    const id = z.uuid().parse(c.req.param('id'));
    if (!(await access(id, c.get('actor'))).organizer)
      return c.json({ error: '仅主办方可发布' }, 403);
    const { content } = publishRecapSchema.parse(await c.req.json());
    const [row] = await db
      .insert(schema.recaps)
      .values({ sessionId: id, content })
      .onConflictDoUpdate({
        target: schema.recaps.sessionId,
        set: { content, publishedAt: new Date() },
      })
      .returning();
    return c.json(row);
  });
  app.get('/sessions/:id/recap', async (c) => {
    const id = z.uuid().parse(c.req.param('id'));
    const permission = await access(id, c.get('actor'));
    if (!permission.organizer && !permission.member)
      return c.json({ error: '加入本场后才能查看回顾' }, 403);
    const [row] = await db
      .select()
      .from(schema.recaps)
      .where(eq(schema.recaps.sessionId, id));
    return c.json({ recap: row ?? null });
  });
  app.get('/sessions/:id/qr', async (c) => {
    const id = z.uuid().parse(c.req.param('id'));
    if (!(await access(id, c.get('actor'))).organizer)
      return c.json({ error: '仅主办方可以生成加入码' }, 403);
    return c.json(
      await sessionQr(
        id,
        config.wechatAppId,
        config.wechatAppSecret,
        config.wechatMiniappEnv,
      ),
    );
  });
  app.onError((error, c) => {
    if (error instanceof z.ZodError || error instanceof SyntaxError)
      return c.json({ error: '请求格式不正确' }, 400);
    return c.json({ error: '服务暂时不可用，请稍后重试' }, 500);
  });
  return app;
}
