import { resolveWechatIdentity, IdentityConflict } from './wechat-identity';
import {
  sessionAccess,
  activitySessions,
  userIdFor,
  type Actor,
} from './permissions';
import { mountMemoryRoutes } from './memory';
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
import { type Database, schema, eq, and, gt, sql } from '@pengtou/database';
const hash = (value: string) =>
  createHash('sha256').update(value).digest('hex');
interface Config {
  allowDevAuth: boolean;
  wechatAppId?: string;
  wechatAppSecret?: string;
  wechatOpenPlatformId?: string;
  wechatMobileAppId?: string;
  wechatMobileAppSecret?: string;
  wechatMiniappEnv?: MiniappEnv;
}
export function createCloudApp(db: Database, config: Config) {
  const app = new Hono<{ Variables: { actor: Actor | null } }>();
  const normalLimit = bodyLimit({
    maxSize: 128 * 1024,
    // 私有文本同步单独受限，不放宽其它接口。

    onError: (c) => c.json({ error: '请求内容过大' }, 413),
  });
  const syncLimit = bodyLimit({
    maxSize: 4 * 1024 * 1024,
    onError: (c) => c.json({ error: '同步文本过大' }, 413),
  });
  app.use('*', (c, next) =>
    c.req.path === '/me/private-ai' && c.req.method === 'PUT'
      ? syncLimit(c, next)
      : normalLimit(c, next),
  );
  app.use('*', async (c, next) => {
    c.header('Cache-Control', 'no-store');
    let actor: Actor | null = null;
    const deviceId = c.req.header('x-installation-id');
    const secret = c.req.header('x-installation-secret');
    const token = c.req.header('authorization')?.replace(/^Bearer /, '');
    if (token && token.length <= 256) {
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
    } else if (
      !c.req.header('authorization') &&
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
  for (const loginPath of ['/auth/wechat', '/auth/wechat/mobile']) {
    app.post(loginPath, async (c) => {
      const mobile = loginPath.endsWith('/mobile');
      const appId = mobile ? config.wechatMobileAppId : config.wechatAppId;
      const appSecret = mobile
        ? config.wechatMobileAppSecret
        : config.wechatAppSecret;
      const input = z
        .object({ code: z.string().min(1).max(256) })
        .strict()
        .parse(await c.req.json());
      let openid: string;
      let unionid: string | undefined;
      if (!mobile && config.allowDevAuth && input.code.startsWith('dev:'))
        openid = input.code;
      else {
        if (!appId || !appSecret)
          return c.json({ error: '微信身份服务尚未配置' }, 503);
        const url = new URL(
          mobile
            ? 'https://api.weixin.qq.com/sns/oauth2/access_token'
            : 'https://api.weixin.qq.com/sns/jscode2session',
        );
        url.search = new URLSearchParams({
          appid: appId,
          secret: appSecret,
          ...(mobile ? { code: input.code } : { js_code: input.code }),
          grant_type: 'authorization_code',
        }).toString();
        const response = await fetch(url, {
          signal: AbortSignal.timeout(10000),
        });
        const result = z
          .object({
            openid: z.string().optional(),
            unionid: z.string().min(1).optional(),
            errcode: z.number().optional(),
          })
          .parse(await response.json());
        if (!response.ok || result.errcode || !result.openid)
          return c.json({ error: '微信登录失败，请重试' }, 401);
        openid = result.openid;
        unionid = result.unionid;
      }
      let userId: string;
      try {
        userId = await resolveWechatIdentity(db, {
          appId:
            !mobile && config.allowDevAuth && input.code.startsWith('dev:')
              ? 'development-miniapp'
              : appId!,
          openid,
          unionid,
          platformId: config.wechatOpenPlatformId,
          legacyMiniapp: !mobile,
        });
      } catch (error) {
        if (error instanceof IdentityConflict)
          return c.json({ error: error.message }, 409);
        throw error;
      }
      const token = randomBytes(32).toString('hex');
      await db.insert(schema.tokens).values({
        hash: hash(token),
        userId,
        expiresAt: new Date(Date.now() + 7 * 86400000),
      });
      return c.json({ token, userId });
    });
  }
  app.post('/auth/logout', async (c) => {
    if (c.get('actor')?.kind !== 'user')
      return c.json({ error: '请先登录' }, 401);
    const token = c.req.header('authorization')!.replace(/^Bearer /, '');
    await db.delete(schema.tokens).where(eq(schema.tokens.hash, hash(token)));
    return c.json({ loggedOut: true });
  });
  app.post('/sessions', async (c) => {
    const actor = c.get('actor');
    if (!actor) return c.json({ error: '请先建立身份' }, 401);
    const input = createSessionSchema.parse(await c.req.json());
    await db
      .insert(schema.sessions)
      .values({
        ...input,
        organizerId: actor.kind === 'device' ? actor.id : null,
        organizerUserId: actor.kind === 'user' ? actor.id : null,
        startsAt: input.startsAt ? new Date(input.startsAt) : null,
      })
      .onConflictDoNothing();
    const [row] = await db
      .select()
      .from(schema.sessions)
      .where(eq(schema.sessions.id, input.id));
    if (!row || !(await sessionAccess(db, input.id, actor)).organizer)
      return c.json({ error: '无法创建此记录' }, 409);
    return c.json(row, 201);
  });
  app.get('/me/profile', async (c) => {
    const actor = c.get('actor');
    const uid = await userIdFor(db, actor);
    if (!uid) return c.json({ error: '请先登录或关联' }, 401);
    const [user] = await db
      .select({ profile: schema.users.profile })
      .from(schema.users)
      .where(eq(schema.users.id, uid));
    return c.json(user ?? { profile: null });
  });
  app.put('/me/profile', async (c) => {
    const actor = c.get('actor');
    const uid = await userIdFor(db, actor);
    if (!uid) return c.json({ error: '请先登录或关联' }, 401);
    const profile = profileSchema.parse(await c.req.json());
    await db
      .update(schema.users)
      .set({ profile })
      .where(eq(schema.users.id, uid));
    return c.json({ profile });
  });
  app.delete('/me/profile', async (c) => {
    const actor = c.get('actor');
    const uid = await userIdFor(db, actor);
    if (!uid) return c.json({ error: '请先登录或关联' }, 401);
    await db
      .update(schema.users)
      .set({ profile: null })
      .where(eq(schema.users.id, uid));
    return c.json({ deleted: true });
  });
  app.get('/me/sessions', async (c) => {
    const actor = c.get('actor');
    if (!actor) return c.json({ error: '请先建立身份' }, 401);
    const { owned, joined } = await activitySessions(db, actor);
    const rows = [
      ...new Map([...joined, ...owned].map((r) => [r.id, r])).values(),
    ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return c.json(
      await Promise.all(
        rows.map(async (row) => {
          const [recap] = await db
            .select()
            .from(schema.recaps)
            .where(eq(schema.recaps.sessionId, row.id));
          return {
            id: row.id,
            title: row.title,
            createdAt: row.createdAt,
            recapPublishedAt: recap?.withdrawnAt
              ? null
              : (recap?.publishedAt ?? null),
          };
        }),
      ),
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
      isOrganizer: (await access(id, c.get('actor'))).organizer,
      isMember: (await access(id, c.get('actor'))).member,
      archived: !!row.archivedAt,
    });
  });
  app.patch('/sessions/:id', async (c) => {
    const id = z.uuid().parse(c.req.param('id'));
    const actor = c.get('actor');
    if (!(await sessionAccess(db, id, actor)).organizer)
      return c.json({ error: '仅发起者可修改' }, 403);
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
      .where(eq(schema.sessions.id, id))
      .returning();
    return row ? c.json(row) : c.json({ error: '无权修改此记录' }, 403);
  });
  app.post('/sessions/:id/join', async (c) => {
    const id = z.uuid().parse(c.req.param('id'));
    const actor = c.get('actor');
    const uid = await userIdFor(db, actor);
    if (!uid) return c.json({ error: '请先微信登录或绑定' }, 401);
    const input = joinSessionSchema.parse(await c.req.json());
    const [session] = await db
      .select()
      .from(schema.sessions)
      .where(eq(schema.sessions.id, id));
    if (!session || session.archivedAt)
      return c.json({ error: '这场不存在或已归档' }, 404);
    await db.transaction(async (txn) => {
      await txn
        .insert(schema.participants)
        .values({ sessionId: id, userId: uid, profile: input.profile })
        .onConflictDoUpdate({
          target: [schema.participants.sessionId, schema.participants.userId],
          set: { profile: input.profile },
        });
      if (input.saveProfile)
        await txn
          .update(schema.users)
          .set({ profile: input.profile })
          .where(eq(schema.users.id, uid));
    });
    return c.json({ joined: true }, 201);
  });
  const access = (id: string, actor: Actor | null) =>
    sessionAccess(db, id, actor);
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
    const { content, version } = publishRecapSchema.parse(await c.req.json());
    const existing = (
      await db
        .select()
        .from(schema.recaps)
        .where(eq(schema.recaps.sessionId, id))
    )[0];
    if (version !== undefined && (existing?.version ?? 0) !== version)
      return c.json({ error: '回顾已更新，请重新查看' }, 409);
    const [row] = await db
      .insert(schema.recaps)
      .values({ sessionId: id, content })
      .onConflictDoUpdate({
        target: schema.recaps.sessionId,
        set: {
          content,
          publishedAt: new Date(),
          withdrawnAt: null,
          version: sql`${schema.recaps.version}+1`,
        },
        ...(version !== undefined
          ? { setWhere: eq(schema.recaps.version, version) }
          : {}),
      })
      .returning();
    return row ? c.json(row) : c.json({ error: '回顾版本冲突' }, 409);
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
    return c.json({
      recap: row?.withdrawnAt ? null : (row ?? null),
      version: row?.version ?? 0,
    });
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
  app.post('/activity-starters', async (c) => {
    const actor = c.get('actor');
    if (!actor) return c.json({ error: '请先建立身份' }, 401);
    const input = createSessionSchema
      .pick({ id: true, title: true, startsAt: true })
      .extend({ profile: profileSchema })
      .strict()
      .parse(await c.req.json());
    const creatorUserId = await userIdFor(db, actor);
    if (!creatorUserId)
      return c.json({ error: '请先关联本人小程序，以便自动加入活动' }, 401);
    const creatorActor = actor.kind + ':' + actor.id;
    await db
      .insert(schema.activityStarters)
      .values({
        id: input.id,
        creatorActor,
        creatorUserId,
        participantProfile: input.profile,
        title: input.title,
        startsAt: input.startsAt ? new Date(input.startsAt) : null,
        sessionId: randomUUID(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      })
      .onConflictDoNothing();
    const [row] = await db
      .select()
      .from(schema.activityStarters)
      .where(eq(schema.activityStarters.id, input.id));
    if (!row || row.creatorActor !== creatorActor)
      return c.json({ error: '不能使用这个发起码' }, 403);
    if (row.expiresAt <= new Date())
      return c.json({ error: '发起码已过期，请重新生成' }, 410);
    return c.json(
      await sessionQr(
        row.id,
        config.wechatAppId,
        config.wechatAppSecret,
        config.wechatMiniappEnv,
        'pages/activity/claim',
      ),
    );
  });
  app.get('/activity-starters/:id', async (c) => {
    const actor = c.get('actor');
    if (!actor) return c.json({ error: '请先建立身份' }, 401);
    const id = z.uuid().parse(c.req.param('id'));
    const [row] = await db
      .select()
      .from(schema.activityStarters)
      .where(eq(schema.activityStarters.id, id));
    if (!row || row.creatorActor !== actor.kind + ':' + actor.id)
      return c.json({ error: '不能查看此发起码' }, 403);
    return c.json({
      claimed: !!row.claimedUserId,
      sessionId: row.claimedUserId ? row.sessionId : null,
      expiresAt: row.expiresAt.toISOString(),
    });
  });
  app.post('/activity-starters/:id/claim', async (c) => {
    const actor = c.get('actor');
    if (!actor || actor.kind !== 'user')
      return c.json({ error: '请用组织者的微信扫码' }, 401);
    const id = z.uuid().parse(c.req.param('id'));
    const result = await db.transaction(async (tx) => {
      const [row] = await tx
        .select()
        .from(schema.activityStarters)
        .where(eq(schema.activityStarters.id, id))
        .for('update');
      if (!row) return { error: '发起码不存在', status: 404 as const };
      if (row.claimedUserId && row.claimedUserId !== actor.id)
        return {
          error: '这场已由另一位组织者发起，请向组织者索取加入码',
          status: 409 as const,
        };
      if (row.claimedUserId) return { sessionId: row.sessionId };
      if (row.expiresAt <= new Date())
        return {
          error: '发起码已过期，请参与者重新生成',
          status: 410 as const,
        };
      await tx.insert(schema.sessions).values({
        id: row.sessionId,
        title: row.title,
        startsAt: row.startsAt,
        organizerUserId: actor.id,
        participantVisibility: 'everyone',
      });
      await tx
        .insert(schema.participants)
        .values({
          sessionId: row.sessionId,
          userId: row.creatorUserId,
          profile: row.participantProfile,
        })
        .onConflictDoNothing();
      await tx
        .update(schema.activityStarters)
        .set({ claimedUserId: actor.id })
        .where(eq(schema.activityStarters.id, id));
      return { sessionId: row.sessionId };
    });
    if ('error' in result)
      return c.json({ error: result.error }, result.status);
    return c.json({ sessionId: result.sessionId });
  });
  mountMemoryRoutes(app, db);
  app.onError((error, c) => {
    if (error instanceof z.ZodError || error instanceof SyntaxError)
      return c.json({ error: '请求格式不正确' }, 400);
    return c.json({ error: '服务暂时不可用，请稍后重试' }, 500);
  });
  return app;
}
