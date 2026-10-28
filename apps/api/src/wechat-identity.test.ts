import { resolveWechatIdentity, IdentityConflict } from './wechat-identity';
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { randomUUID, randomBytes } from 'node:crypto';
import { connectDatabase, postgres, schema } from '@pengtou/database';
import { migrateCloud } from '../../../packages/database/src/migrate';
import { createCloudApp } from './cloud';
const base = process.env.TEST_DATABASE_URL;
describe.skipIf(!base)('微信账号身份真实数据库验证', () => {
  let conn: ReturnType<typeof connectDatabase>,
    admin: ReturnType<typeof postgres>,
    app: ReturnType<typeof createCloudApp>;
  const dbName = 'qg_account_' + randomBytes(5).toString('hex');
  beforeAll(async () => {
    admin = postgres(base!, { max: 1 });
    await admin.unsafe(`CREATE DATABASE ${dbName}`);
    const url = new URL(base!);
    url.pathname = '/' + dbName;
    conn = connectDatabase(url.toString());
    await migrateCloud(conn.sql);
    app = createCloudApp(conn.db, { allowDevAuth: true });
  }, 30000);
  afterAll(async () => {
    await conn?.sql.end();
    if (admin) {
      await admin.unsafe(`DROP DATABASE IF EXISTS ${dbName}`);
      await admin.end();
    }
  });
  it('保留旧用户 ID 并按 AppID 隔离相同 OpenID', async () => {
    const oldId = randomUUID();
    await conn.db.insert(schema.users).values({ id: oldId, openid: 'old' });
    const mini = { appId: 'mini', openid: 'old', legacyMiniapp: true };
    expect(await resolveWechatIdentity(conn.db, mini)).toBe(oldId);
    expect(await resolveWechatIdentity(conn.db, mini)).toBe(oldId);
    const mobile = await resolveWechatIdentity(conn.db, {
      ...mini,
      appId: 'mobile',
      legacyMiniapp: false,
    });
    expect(mobile).not.toBe(oldId);
  });
  it('可信 UnionID 跨端同账号，缺失时不猜测身份', async () => {
    const mini = {
      appId: 'mini',
      openid: 'union-mini',
      legacyMiniapp: true,
      unionid: 'union',
      platformId: 'platform',
    };
    const uid = await resolveWechatIdentity(conn.db, mini);
    const mobile = {
      ...mini,
      appId: 'mobile',
      openid: 'union-mobile',
      legacyMiniapp: false,
    };
    expect(await resolveWechatIdentity(conn.db, mobile)).toBe(uid);
    expect(
      await resolveWechatIdentity(conn.db, {
        ...mobile,
        openid: 'missing',
        unionid: undefined,
      }),
    ).not.toBe(uid);
    expect(
      await resolveWechatIdentity(conn.db, {
        ...mobile,
        openid: 'another-platform',
        platformId: 'other',
      }),
    ).not.toBe(uid);
  });
  it('两个已有账号冲突不吞并历史，事务回滚', async () => {
    const a = {
      appId: 'mini',
      openid: 'conflict-a',
      legacyMiniapp: true,
      platformId: 'platform',
      unionid: 'conflict',
    };
    const first = await resolveWechatIdentity(conn.db, a);
    const b = { appId: 'mobile', openid: 'conflict-b', legacyMiniapp: false };
    const second = await resolveWechatIdentity(conn.db, b);
    await expect(
      resolveWechatIdentity(conn.db, {
        ...b,
        platformId: a.platformId,
        unionid: a.unionid,
      }),
    ).rejects.toBeInstanceOf(IdentityConflict);
    expect(await resolveWechatIdentity(conn.db, b)).toBe(second);
    expect(first).not.toBe(second);
  });
  it('首次并发登录幂等；客户端不得提交 UnionID；移动资质缺失返回503', async () => {
    const input = { appId: 'mini', openid: 'concurrent', legacyMiniapp: true };
    const ids = await Promise.all([
      resolveWechatIdentity(conn.db, input),
      resolveWechatIdentity(conn.db, input),
    ]);
    expect(ids[0]).toBe(ids[1]);
    const response = await app.request('/auth/wechat/mobile', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code: 'test' }),
    });
    expect(response.status).toBe(503);
    const invalid = await app.request('/auth/wechat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code: 'dev:test', unionid: 'fake' }),
    });
    expect(invalid.status).toBe(400);
  });
  it('退出立即撤销当前令牌，旧令牌不能恢复账号身份', async () => {
    const login = await app.request('/auth/wechat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code: 'dev:logout' }),
    });
    const { token } = await login.json();
    const headers = { authorization: 'Bearer ' + token };
    expect((await app.request('/me/profile', { headers })).status).toBe(200);
    expect(
      (await app.request('/auth/logout', { method: 'POST', headers })).status,
    ).toBe(200);
    expect((await app.request('/me/profile', { headers })).status).toBe(401);
  });
});
