import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { randomUUID, randomBytes } from 'node:crypto';
import { connectDatabase, postgres, schema, eq } from '@pengtou/database';
import { migrateCloud } from '../../../packages/database/src/migrate';
import { createCloudApp } from './cloud';
const base = process.env.TEST_DATABASE_URL;
describe.skipIf(!base)('参与者发起码真实数据库闭环', () => {
  let conn: ReturnType<typeof connectDatabase>,
    admin: ReturnType<typeof postgres>,
    app: ReturnType<typeof createCloudApp>;
  const dbName = 'qg_starter_' + randomBytes(5).toString('hex');
  let a: Record<string, string>,
    b: Record<string, string>,
    d: Record<string, string>;
  const id = randomUUID();
  const body = {
    id,
    title: '仅共享名称',
    startsAt: null,
    profile: { name: '测试参与者', introduction: '测试介绍' },
  };
  const req = (
    path: string,
    method = 'GET',
    data?: unknown,
    headers: Record<string, string> = {},
  ) =>
    app.request(path, {
      method,
      headers: { 'content-type': 'application/json', ...headers },
      ...(data ? { body: JSON.stringify(data) } : {}),
    });
  beforeAll(async () => {
    admin = postgres(base!, { max: 1 });
    await admin.unsafe(`CREATE DATABASE ${dbName}`);
    const url = new URL(base!);
    url.pathname = '/' + dbName;
    conn = connectDatabase(url.toString());
    await migrateCloud(conn.sql);
    app = createCloudApp(conn.db, { allowDevAuth: true });
    const auth = async (code: string) => ({
      authorization:
        'Bearer ' +
        (
          await (
            await req('/auth/wechat', 'POST', { code: 'dev:' + code })
          ).json()
        ).token,
    });
    a = await auth('starter');
    b = await auth('organizer');
    d = await auth('other');
  }, 30000);
  afterAll(async () => {
    await conn?.sql.end();
    if (admin) {
      await admin.unsafe(`DROP DATABASE IF EXISTS ${dbName}`);
      await admin.end();
    }
  });
  it('拒绝匿名生成和私人字段', async () => {
    expect((await req('/activity-starters', 'POST', body)).status).toBe(401);
    expect(
      (
        await req(
          '/activity-starters',
          'POST',
          { ...body, notes: '禁止传递' },
          a,
        )
      ).status,
    ).toBe(400);
  });
  it('生成码不会提前创建活动或公开私人资料', async () => {
    const r = await req('/activity-starters', 'POST', body, a);
    expect(r.status).toBe(200);
    expect((await r.json()).miniappPath).toBe(
      '/pages/activity/claim?sid=' + id,
    );
    expect(await conn.db.select().from(schema.sessions)).toHaveLength(0);
    expect(
      (await req('/activity-starters/' + id, 'GET', undefined, d)).status,
    ).toBe(403);
  });
  it('扫码原子创建并自动加入分享人；重复扫码幂等', async () => {
    const responses = await Promise.all([
      req(`/activity-starters/${id}/claim`, 'POST', {}, b),
      req(`/activity-starters/${id}/claim`, 'POST', {}, b),
    ]);
    expect(responses.map((r) => r.status)).toEqual([200, 200]);
    const rows = await Promise.all(responses.map((r) => r.json()));
    expect(rows[0].sessionId).toBe(rows[1].sessionId);
    const sessions = await conn.db.select().from(schema.sessions);
    expect(sessions).toHaveLength(1);
    const people = await conn.db.select().from(schema.participants);
    expect(people).toHaveLength(1);
    expect(people[0]!.profile).toEqual(body.profile);
    expect(sessions[0]!.organizerUserId).not.toBe(people[0]!.userId);
    expect(await conn.db.select().from(schema.entries)).toHaveLength(0);
    expect(await conn.db.select().from(schema.privateAI)).toHaveLength(0);
  });
  it('其他组织者不能再认领，分享人可查询加入结果', async () => {
    expect(
      (await req(`/activity-starters/${id}/claim`, 'POST', {}, d)).status,
    ).toBe(409);
    const r = await req('/activity-starters/' + id, 'GET', undefined, a);
    expect((await r.json()).claimed).toBe(true);
  });
  it('过期未认领码不创建活动', async () => {
    const expired = randomUUID();
    expect(
      (await req('/activity-starters', 'POST', { ...body, id: expired }, a))
        .status,
    ).toBe(200);
    await conn.db
      .update(schema.activityStarters)
      .set({ expiresAt: new Date(0) })
      .where(eq(schema.activityStarters.id, expired));
    expect(
      (await req(`/activity-starters/${expired}/claim`, 'POST', {}, b)).status,
    ).toBe(410);
    expect(await conn.db.select().from(schema.sessions)).toHaveLength(1);
  });
  it('删除本人云端资料同时使发起码失效，不能恢复加入', async () => {
    expect((await req('/me/data', 'DELETE', undefined, a)).status).toBe(200);
    expect(await conn.db.select().from(schema.activityStarters)).toHaveLength(
      0,
    );
    expect(
      (await req(`/activity-starters/${id}/claim`, 'POST', {}, b)).status,
    ).toBe(404);
    expect(await conn.db.select().from(schema.participants)).toHaveLength(0);
    expect(await conn.db.select().from(schema.sessions)).toHaveLength(1);
  });
});
