import type { Hono } from 'hono';
import { randomUUID, randomBytes, createHash } from 'node:crypto';
import { z } from 'zod';
import {
  type Database,
  schema,
  eq,
  and,
  isNull,
  desc,
  sql,
} from '@pengtou/database';
import {
  entrySchema,
  updateEntrySchema,
  privateAISchema,
  type ActivityItem,
} from '@pengtou/contracts';
import {
  activeBinding,
  userIdFor,
  sessionAccess,
  activitySessions,
  type Actor,
} from './permissions';
const hash = (v: string) => createHash('sha256').update(v).digest('hex');
type App = Hono<{ Variables: { actor: Actor | null } }>;
const idOf = (v: string) => z.uuid().parse(v);
export function mountMemoryRoutes(app: App, db: Database) {
  app.use('/me/*', async (c, next) => {
    c.header('Cache-Control', 'no-store');
    await next();
  });
  app.get('/bindings', async (c) => {
    const a = c.get('actor');
    if (!a) return c.json({ error: '请先建立身份' }, 401);
    const uid = await userIdFor(db, a);
    const rows =
      a.kind === 'device'
        ? (await activeBinding(db, a))
          ? [await activeBinding(db, a)]
          : []
        : await db
            .select()
            .from(schema.bindings)
            .where(
              and(
                eq(schema.bindings.userId, a.id),
                isNull(schema.bindings.revokedAt),
              ),
            );
    return c.json({ userId: uid, bindings: rows });
  });
  app.post('/bindings/challenges', async (c) => {
    const a = c.get('actor');
    if (a?.kind !== 'device') return c.json({ error: '需要设备身份' }, 401);
    const token = randomBytes(32).toString('hex');
    const code = randomBytes(6).toString('hex').toUpperCase();
    const id = randomUUID();
    const expiresAt = new Date(Date.now() + 300000);
    const result = await db.transaction(async (tx) => {
      await tx.execute(
        sql`SELECT id FROM installations WHERE id=${a.id} FOR UPDATE`,
      );
      const [count] = await tx
        .select({ n: sql<number>`count(*)::integer` })
        .from(schema.challenges)
        .where(
          and(
            eq(schema.challenges.installationId, a.id),
            sql`${schema.challenges.createdAt}>now()-interval '5 minutes'`,
          ),
        );
      if ((count?.n ?? 0) >= 5) return false;
      await tx
        .update(schema.challenges)
        .set({ consumedAt: new Date() })
        .where(
          and(
            eq(schema.challenges.installationId, a.id),
            isNull(schema.challenges.consumedAt),
          ),
        );
      await tx.insert(schema.challenges).values({
        id,
        installationId: a.id,
        tokenHash: hash(token),
        codeHash: hash(code),
        expiresAt,
      });
      return true;
    });
    return result
      ? c.json({ id, token, code, expiresAt }, 201)
      : c.json({ error: '操作较多，请稍后再试' }, 429);
  });
  app.post('/bindings/claim', async (c) => {
    const a = c.get('actor');
    if (a?.kind !== 'user') return c.json({ error: '请在微信登录后关联' }, 401);
    const { code } = z
      .object({ code: z.string().trim().min(12).max(64) })
      .strict()
      .parse(await c.req.json());
    // 数据库计数跨进程有效；错误尝试也提交，不使用事务回滚消除限速。
    const result = await db.transaction(async (tx) => {
      const rows = await tx.execute(
        sql`INSERT INTO binding_attempts(actor_id,attempts) VALUES(${a.id},1) ON CONFLICT(actor_id) DO UPDATE SET attempts=CASE WHEN binding_attempts.window_at<now()-interval '5 minutes' THEN 1 ELSE binding_attempts.attempts+1 END, window_at=CASE WHEN binding_attempts.window_at<now()-interval '5 minutes' THEN now() ELSE binding_attempts.window_at END RETURNING attempts`,
      );
      if (Number(rows[0]?.attempts) > 10)
        return { status: 429 as const, error: '尝试过多，请稍后再试' };
      const digest = hash(code.length === 12 ? code.toUpperCase() : code);
      const found = await tx.execute(
        sql`SELECT * FROM binding_challenges WHERE (token_hash=${digest} OR code_hash=${digest}) AND consumed_at IS NULL AND expires_at>now() FOR UPDATE`,
      );
      if (!found[0] || found[0].claimed_user_id)
        return { status: 409 as const, error: '绑定码已失效或已使用' };
      await tx
        .update(schema.challenges)
        .set({ claimedUserId: a.id })
        .where(eq(schema.challenges.id, String(found[0].id)));
      return { status: 200 as const, error: null };
    });
    return result.error
      ? c.json({ error: result.error }, result.status)
      : c.json({ claimed: true, message: '请回到 App 确认' });
  });
  app.get('/bindings/challenges/:id', async (c) => {
    const a = c.get('actor');
    if (a?.kind !== 'device') return c.json({ error: '需要设备身份' }, 401);
    const [ch] = await db
      .select()
      .from(schema.challenges)
      .where(
        and(
          eq(schema.challenges.id, idOf(c.req.param('id'))),
          eq(schema.challenges.installationId, a.id),
        ),
      );
    if (!ch) return c.json({ error: '绑定不存在' }, 404);
    const user = ch.claimedUserId
      ? (
          await db
            .select({ profile: schema.users.profile })
            .from(schema.users)
            .where(eq(schema.users.id, ch.claimedUserId))
        )[0]
      : null;
    return c.json({
      id: ch.id,
      claimed: !!ch.claimedUserId,
      displayName: user?.profile?.name ?? '微信用户',
      identityHint: ch.claimedUserId?.slice(-6) ?? null,
      expired: ch.expiresAt < new Date(),
      consumed: !!ch.consumedAt,
    });
  });
  app.post('/bindings/challenges/:id/confirm', async (c) => {
    const a = c.get('actor');
    if (a?.kind !== 'device') return c.json({ error: '需要设备身份' }, 401);
    const input = z
      .object({ confirm: z.literal(true) })
      .strict()
      .parse(await c.req.json());
    void input;
    const binding = await db.transaction(async (tx) => {
      await tx.execute(
        sql`SELECT id FROM installations WHERE id=${a.id} FOR UPDATE`,
      );
      const rows = await tx.execute(
        sql`SELECT * FROM binding_challenges WHERE id=${idOf(c.req.param('id'))} AND installation_id=${a.id} AND consumed_at IS NULL AND expires_at>now() FOR UPDATE`,
      );
      const ch = rows[0];
      if (!ch?.claimed_user_id) return null;
      if (
        (
          await tx
            .select()
            .from(schema.bindings)
            .where(
              and(
                eq(schema.bindings.installationId, a.id),
                isNull(schema.bindings.revokedAt),
              ),
            )
        ).length
      )
        return null;
      const [row] = await tx
        .insert(schema.bindings)
        .values({
          id: randomUUID(),
          installationId: a.id,
          userId: String(ch.claimed_user_id),
        })
        .returning();
      await tx
        .update(schema.challenges)
        .set({ consumedAt: new Date() })
        .where(eq(schema.challenges.id, String(ch.id)));
      await tx.insert(schema.privacyAudit).values({
        id: randomUUID(),
        actorId: a.id,
        action: 'binding_confirmed',
      });
      return row;
    });
    return binding
      ? c.json(binding)
      : c.json(
          { error: '绑定未完成：码已失效、尚未认领或设备已绑定，请先检查' },
          409,
        );
  });
  app.delete('/bindings/:id', async (c) => {
    const a = c.get('actor');
    if (!a) return c.json({ error: '请先登录' }, 401);
    const id = idOf(c.req.param('id'));
    const [b] = await db
      .select()
      .from(schema.bindings)
      .where(eq(schema.bindings.id, id));
    if (
      !b ||
      (a.kind === 'device' ? b.installationId !== a.id : b.userId !== a.id)
    )
      return c.json({ error: '绑定不存在' }, 404);
    await db.transaction(async (tx) => {
      await tx.execute(
        sql`SELECT id FROM installations WHERE id=${b.installationId} FOR UPDATE`,
      );
      await tx
        .update(schema.bindings)
        .set({ revokedAt: new Date() })
        .where(eq(schema.bindings.id, id));
      await tx
        .delete(schema.privateAI)
        .where(eq(schema.privateAI.bindingId, id));
      await tx
        .update(schema.challenges)
        .set({ consumedAt: new Date() })
        .where(eq(schema.challenges.installationId, b.installationId));
      await tx
        .insert(schema.privacyAudit)
        .values({ id: randomUUID(), actorId: a.id, action: 'binding_revoked' });
    });
    return c.json({ deleted: true });
  });
  app.get('/me/activities', async (c) => {
    const a = c.get('actor');
    if (!a) return c.json({ error: '请先登录或绑定' }, 401);
    const offset = z.coerce
      .number()
      .int()
      .min(0)
      .max(100000)
      .default(0)
      .parse(c.req.query('offset'));
    const { owned, joined, uid } = await activitySessions(db, a);
    const map = new Map<string, ActivityItem>();
    for (const [rows, relation] of [
      [joined, 'participant'],
      [owned, 'organizer'],
    ] as const)
      for (const s of rows)
        map.set(s.id, {
          id: s.id,
          title: s.title,
          occurredAt: (s.startsAt ?? s.createdAt).toISOString(),
          relation,
          sessionId: s.id,
          entryIds: [],
        });
    const entries = uid
      ? await db
          .select()
          .from(schema.entries)
          .where(eq(schema.entries.userId, uid))
      : [];
    for (const e of entries) {
      const key = e.sessionId ?? e.id;
      const item = map.get(key);
      if (item) item.entryIds.push(e.id);
      else
        map.set(key, {
          id: key,
          title: e.title,
          occurredAt: e.occurredAt.toISOString(),
          relation: 'private',
          sessionId: e.sessionId,
          entryIds: [e.id],
        });
    }
    const snapshots = uid
      ? await db
          .select({ result: schema.privateAI })
          .from(schema.privateAI)
          .innerJoin(
            schema.bindings,
            eq(schema.privateAI.bindingId, schema.bindings.id),
          )
          .where(
            and(
              eq(schema.privateAI.userId, uid),
              isNull(schema.privateAI.deletedAt),
              isNull(schema.bindings.revokedAt),
            ),
          )
      : [];
    for (const { result: r } of snapshots) {
      const key = r.sessionId ?? r.localSessionId;
      if (!map.has(key))
        map.set(key, {
          id: key,
          title: r.title,
          occurredAt: r.updatedAt.toISOString(),
          relation: 'private',
          sessionId: r.sessionId,
          entryIds: [],
        });
    }
    const rows = [...map.values()].sort(
      (a, b) =>
        b.occurredAt.localeCompare(a.occurredAt) || a.id.localeCompare(b.id),
    );
    return c.json({
      items: rows.slice(offset, offset + 50),
      nextOffset: offset + 50 < rows.length ? offset + 50 : null,
    });
  });
  app.get('/me/entries', async (c) => {
    const uid = await userIdFor(db, c.get('actor'));
    if (!uid) return c.json({ error: '请先登录或绑定' }, 401);
    return c.json(
      await db
        .select()
        .from(schema.entries)
        .where(eq(schema.entries.userId, uid))
        .orderBy(desc(schema.entries.occurredAt)),
    );
  });
  app.post('/me/entries', async (c) => {
    const uid = await userIdFor(db, c.get('actor'));
    if (!uid) return c.json({ error: '请先登录或绑定' }, 401);
    const input = entrySchema.parse(await c.req.json());
    if (input.sessionId) {
      const p = await sessionAccess(db, input.sessionId, c.get('actor'));
      if (!p.member && !p.organizer)
        return c.json({ error: '请先加入这场' }, 403);
    }
    await db
      .insert(schema.entries)
      .values({ ...input, userId: uid, occurredAt: new Date(input.occurredAt) })
      .onConflictDoNothing();
    const [row] = await db
      .select()
      .from(schema.entries)
      .where(
        and(eq(schema.entries.id, input.id), eq(schema.entries.userId, uid)),
      );
    return row ? c.json(row, 201) : c.json({ error: '记录编号冲突' }, 409);
  });
  app.get('/me/entries/:id', async (c) => {
    const uid = await userIdFor(db, c.get('actor'));
    if (!uid) return c.json({ error: '请先登录或绑定' }, 401);
    const [row] = await db
      .select()
      .from(schema.entries)
      .where(
        and(
          eq(schema.entries.id, idOf(c.req.param('id'))),
          eq(schema.entries.userId, uid),
        ),
      );
    return row ? c.json(row) : c.json({ error: '记录不存在' }, 404);
  });
  app.patch('/me/entries/:id', async (c) => {
    const uid = await userIdFor(db, c.get('actor'));
    if (!uid) return c.json({ error: '请先登录或绑定' }, 401);
    const input = updateEntrySchema.parse(await c.req.json());
    if (input.sessionId) {
      const p = await sessionAccess(db, input.sessionId, c.get('actor'));
      if (!p.member && !p.organizer)
        return c.json({ error: '请先加入这场' }, 403);
    }
    const [row] = await db
      .update(schema.entries)
      .set({
        ...input,
        occurredAt: input.occurredAt ? new Date(input.occurredAt) : undefined,
        version: input.version + 1,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(schema.entries.id, idOf(c.req.param('id'))),
          eq(schema.entries.userId, uid),
          eq(schema.entries.version, input.version),
        ),
      )
      .returning();
    return row
      ? c.json(row)
      : c.json(
          { error: '记录已更新或不存在，请重新打开；当前草稿未覆盖云端' },
          409,
        );
  });
  app.delete('/me/entries/:id', async (c) => {
    const uid = await userIdFor(db, c.get('actor'));
    if (!uid) return c.json({ error: '请先登录或绑定' }, 401);
    const id = idOf(c.req.param('id'));
    await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT id FROM users WHERE id=${uid} FOR UPDATE`);
      await tx
        .delete(schema.entries)
        .where(and(eq(schema.entries.id, id), eq(schema.entries.userId, uid)));
    });
    return c.json({ deleted: true });
  });
  app.get('/me/private-ai/state/:id', async (c) => {
    const a = c.get('actor');
    if (a?.kind !== 'device') return c.json({ error: '需要绑定设备身份' }, 403);
    const b = await activeBinding(db, a);
    if (!b) return c.json({ error: '请先关联小程序' }, 403);
    const [r] = await db
      .select()
      .from(schema.privateAI)
      .where(
        and(
          eq(schema.privateAI.bindingId, b.id),
          eq(schema.privateAI.localSessionId, idOf(c.req.param('id'))),
        ),
      );
    return c.json({
      id: r?.id ?? null,
      version: r?.version ?? 0,
      fields: r?.fields ?? [],
      sourceVersion: r?.sourceVersion ?? null,
      deleted: !!r?.deletedAt,
    });
  });
  app.put('/me/private-ai', async (c) => {
    const a = c.get('actor');
    if (a?.kind !== 'device')
      return c.json({ error: '仅绑定 App 可同步' }, 403);
    const input = privateAISchema.parse(await c.req.json());
    const result = await db.transaction(async (tx) => {
      await tx.execute(
        sql`SELECT id FROM installations WHERE id=${a.id} FOR UPDATE`,
      );
      const b = await activeBinding(tx, a);
      if (!b || b.id !== input.bindingId) return null;
      if (input.sessionId) {
        const p = await sessionAccess(tx, input.sessionId, a);
        if (!p.member && !p.organizer) return null;
      }
      const [current] = await tx
        .select()
        .from(schema.privateAI)
        .where(
          and(
            eq(schema.privateAI.bindingId, b.id),
            eq(schema.privateAI.localSessionId, input.localSessionId),
          ),
        );
      if ((current?.version ?? 0) !== input.version) return null;
      const data = {
        ...input,
        deletedAt: null,
        userId: b.userId,
        version: input.version + 1,
        updatedAt: new Date(),
      };
      if (current) {
        return (
          await tx
            .update(schema.privateAI)
            .set(data)
            .where(eq(schema.privateAI.id, current.id))
            .returning()
        )[0];
      }
      return (
        await tx
          .insert(schema.privateAI)
          .values({ ...data, id: randomUUID() })
          .returning()
      )[0];
    });
    return result
      ? c.json(result)
      : c.json({ error: '绑定失效、活动无权限或版本冲突，请重新确认' }, 409);
  });
  app.get('/me/private-ai', async (c) => {
    const uid = await userIdFor(db, c.get('actor'));
    if (!uid) return c.json({ error: '请先登录或绑定' }, 401);
    const rows = await db
      .select({ result: schema.privateAI })
      .from(schema.privateAI)
      .innerJoin(
        schema.bindings,
        eq(schema.privateAI.bindingId, schema.bindings.id),
      )
      .where(
        and(
          eq(schema.privateAI.userId, uid),
          isNull(schema.privateAI.deletedAt),
          isNull(schema.bindings.revokedAt),
        ),
      )
      .orderBy(desc(schema.privateAI.updatedAt));
    return c.json(rows.map((r) => r.result));
  });
  app.delete('/me/private-ai/:id', async (c) => {
    const uid = await userIdFor(db, c.get('actor'));
    if (!uid) return c.json({ error: '请先登录或绑定' }, 401);
    const id = idOf(c.req.param('id'));
    const result = await db.transaction(async (tx) => {
      const [r] = await tx
        .select()
        .from(schema.privateAI)
        .where(
          and(eq(schema.privateAI.id, id), eq(schema.privateAI.userId, uid)),
        );
      if (!r) return null;
      const [b] = await tx
        .select()
        .from(schema.bindings)
        .where(eq(schema.bindings.id, r.bindingId));
      if (!b) return null;
      await tx.execute(
        sql`SELECT id FROM installations WHERE id=${b.installationId} FOR UPDATE`,
      );
      return (
        await tx
          .update(schema.privateAI)
          .set({
            deletedAt: new Date(),
            content: {},
            fields: [],
            version: sql`${schema.privateAI.version}+1`,
          })
          .where(
            and(eq(schema.privateAI.id, id), eq(schema.privateAI.userId, uid)),
          )
          .returning()
      )[0];
    });
    return c.json({ deleted: true, version: result?.version });
  });
  app.delete('/sessions/:id/recap', async (c) => {
    const id = idOf(c.req.param('id'));
    if (!(await sessionAccess(db, id, c.get('actor'))).organizer)
      return c.json({ error: '仅发起者可撤回' }, 403);
    await db
      .update(schema.recaps)
      .set({
        withdrawnAt: new Date(),
        version: sql`${schema.recaps.version}+1`,
      })
      .where(eq(schema.recaps.sessionId, id));
    return c.json({ withdrawn: true });
  });
  app.delete('/sessions/:id', async (c) => {
    const id = idOf(c.req.param('id'));
    if (!(await sessionAccess(db, id, c.get('actor'))).organizer)
      return c.json({ error: '仅发起者可归档' }, 403);
    await db
      .update(schema.sessions)
      .set({ archivedAt: new Date() })
      .where(eq(schema.sessions.id, id));
    return c.json({ archived: true });
  });
  app.delete('/me/data', async (c) => {
    const a = c.get('actor');
    if (a?.kind !== 'user')
      return c.json({ error: '请在微信端确认删除本人云端资料' }, 403);
    await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT id FROM users WHERE id=${a.id} FOR UPDATE`);
      const bs = await tx
        .select()
        .from(schema.bindings)
        .where(eq(schema.bindings.userId, a.id));
      for (const b of bs)
        await tx.execute(
          sql`SELECT id FROM installations WHERE id=${b.installationId} FOR UPDATE`,
        );
      await tx.delete(schema.entries).where(eq(schema.entries.userId, a.id));
      await tx
        .delete(schema.privateAI)
        .where(eq(schema.privateAI.userId, a.id));
      await tx
        .update(schema.bindings)
        .set({ revokedAt: new Date() })
        .where(eq(schema.bindings.userId, a.id));
      await tx
        .update(schema.challenges)
        .set({ consumedAt: new Date() })
        .where(eq(schema.challenges.claimedUserId, a.id));
      await tx
        .delete(schema.participants)
        .where(eq(schema.participants.userId, a.id));
      const own = await tx
        .select()
        .from(schema.sessions)
        .where(eq(schema.sessions.organizerUserId, a.id));
      for (const s of own)
        await tx
          .update(schema.recaps)
          .set({
            content: '',
            withdrawnAt: new Date(),
            version: sql`${schema.recaps.version}+1`,
          })
          .where(eq(schema.recaps.sessionId, s.id));
      await tx
        .update(schema.sessions)
        .set({ archivedAt: new Date(), title: '已归档活动' })
        .where(eq(schema.sessions.organizerUserId, a.id));
      await tx
        .update(schema.users)
        .set({ profile: null, openid: `deleted:${randomUUID()}` })
        .where(eq(schema.users.id, a.id));
      await tx.delete(schema.tokens).where(eq(schema.tokens.userId, a.id));
      await tx.insert(schema.privacyAudit).values({
        id: randomUUID(),
        actorId: a.id,
        action: 'user_data_deleted',
      });
    });
    return c.json({ deleted: true });
  });
}
