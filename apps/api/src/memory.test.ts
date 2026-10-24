import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { randomUUID, randomBytes, createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { connectDatabase, postgres } from '@pengtou/database';
import { migrateCloud } from '../../../packages/database/src/migrate';
import { createCloudApp } from './cloud';
const base = process.env.TEST_DATABASE_URL;
describe.skipIf(!base)('v0.2 真实 PostgreSQL 迁移及权限', () => {
  const name = `qinggai_v02_${randomBytes(6).toString('hex')}`;
  let connection: ReturnType<typeof connectDatabase>;
  let admin: ReturnType<typeof postgres>;
  let app: ReturnType<typeof createCloudApp>;
  const device = { id: randomUUID(), secret: randomBytes(32).toString('hex') };
  const dh = {
    'x-installation-id': device.id,
    'x-installation-secret': device.secret,
  };
  let ah: Record<string, string>;
  let bh: Record<string, string>;
  const legacy = randomUUID();
  const req = (
    path: string,
    method = 'GET',
    body?: unknown,
    headers: Record<string, string> = {},
  ) =>
    app.request(path, {
      method,
      headers: { 'content-type': 'application/json', ...headers },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  async function login(who: string) {
    const r = await req('/auth/wechat', 'POST', { code: 'dev:' + who });
    return { authorization: 'Bearer ' + (await r.json()).token };
  }
  async function bind(headers = ah, d = dh) {
    const create = await req('/bindings/challenges', 'POST', {}, d);
    expect(create.status).toBe(201);
    const ch = await create.json();
    expect(
      (await req('/bindings/claim', 'POST', { code: ch.code }, headers)).status,
    ).toBe(200);
    const confirm = await req(
      `/bindings/challenges/${ch.id}/confirm`,
      'POST',
      { confirm: true },
      d,
    );
    expect(confirm.status).toBe(200);
    return { ch, binding: await confirm.json() };
  }
  beforeAll(async () => {
    admin = postgres(base!, { max: 1 });
    await admin.unsafe(`CREATE DATABASE ${name}`);
    const url = new URL(base!);
    url.pathname = '/' + name;
    connection = connectDatabase(url.toString());
    const source = await readFile(
      new URL(
        '../../../packages/database/migrations/0001_shared_sessions.sql',
        import.meta.url,
      ),
      'utf8',
    );
    await connection.sql.unsafe(source);
    await connection.sql`CREATE TABLE pengtou_migrations(version INTEGER PRIMARY KEY,checksum TEXT NOT NULL,applied_at TIMESTAMPTZ NOT NULL DEFAULT now())`;
    await connection.sql`INSERT INTO pengtou_migrations(version,checksum) VALUES(1,${createHash('sha256').update(source).digest('hex')})`;
    await connection.sql`INSERT INTO installations(id,secret_hash) VALUES(${device.id},${createHash('sha256').update(device.secret).digest('hex')})`;
    await connection.sql`INSERT INTO sessions(id,organizer_id,title,participant_visibility) VALUES(${legacy},${device.id},'历史活动','everyone')`;
    await connection.sql`INSERT INTO recaps(session_id,content) VALUES(${legacy},'历史已发布回顾')`;
    await migrateCloud(connection.sql);
    await migrateCloud(connection.sql);
    app = createCloudApp(connection.db, {
      allowDevAuth: true,
    });
    ah = await login('a');
    bh = await login('b');
  }, 30000);
  afterAll(async () => {
    await connection?.sql.end();
    if (admin) {
      await admin.unsafe(`DROP DATABASE ${name}`);
      await admin.end();
    }
  });
  it('v1 数据升级保留 ID、创建者及回顾；历史校验被篡改会拒绝', async () => {
    const [r] = await connection.sql`SELECT * FROM sessions WHERE id=${legacy}`;
    expect(r!.organizer_id).toBe(device.id);
    expect(
      (
        await (
          await req(`/sessions/${legacy}/recap`, 'GET', undefined, dh)
        ).json()
      ).recap.content,
    ).toBe('历史已发布回顾');
    await connection.sql`UPDATE pengtou_migrations SET checksum='bad' WHERE version=1`;
    await expect(migrateCloud(connection.sql)).rejects.toThrow(
      '已执行迁移不能修改',
    );
    const source = await readFile(
      new URL(
        '../../../packages/database/migrations/0001_shared_sessions.sql',
        import.meta.url,
      ),
      'utf8',
    );
    await connection.sql`UPDATE pengtou_migrations SET checksum=${createHash('sha256').update(source).digest('hex')} WHERE version=1`;
  });
  it('小程序可独立创建私人记录，严格隔离、版本冲突和删除', async () => {
    const id = randomUUID();
    const input = {
      id,
      title: '自己记的读书会',
      occurredAt: new Date().toISOString(),
      notes: '私人心得',
      people: [{ name: '朋友', note: '想聊书' }],
    };
    expect((await req('/me/entries', 'POST', input, ah)).status).toBe(201);
    expect((await req(`/me/entries/${id}`, 'GET', undefined, bh)).status).toBe(
      404,
    );
    expect(
      (
        await req(
          `/me/entries/${id}`,
          'PATCH',
          { version: 1, notes: '更新' },
          ah,
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await req(
          `/me/entries/${id}`,
          'PATCH',
          { version: 1, notes: '旧版覆盖' },
          ah,
        )
      ).status,
    ).toBe(409);
    expect((await req('/me/activities', 'GET', undefined, ah)).status).toBe(
      200,
    );
    await req(`/me/entries/${id}`, 'DELETE', undefined, bh);
    expect((await req(`/me/entries/${id}`, 'GET', undefined, ah)).status).toBe(
      200,
    );
    await req(`/me/entries/${id}`, 'DELETE', undefined, ah);
    expect((await req(`/me/entries/${id}`, 'GET', undefined, ah)).status).toBe(
      404,
    );
  });
  it('微信发起、成员权限、关联私人记录和回顾撤回修订', async () => {
    const id = randomUUID();
    expect(
      (
        await req(
          '/sessions',
          'POST',
          { id, title: '微信发起', participantVisibility: 'organizer_only' },
          ah,
        )
      ).status,
    ).toBe(201);
    await req(
      `/sessions/${id}/join`,
      'POST',
      { profile: { name: 'B', introduction: '读书' }, saveProfile: false },
      bh,
    );
    expect(
      (await req(`/sessions/${id}/participants`, 'GET', undefined, ah)).status,
    ).toBe(200);
    expect(
      (await req(`/sessions/${id}/participants`, 'GET', undefined, bh)).status,
    ).toBe(403);
    expect(
      (await req(`/sessions/${id}/recap`, 'POST', { content: '越权' }, bh))
        .status,
    ).toBe(403);
    await req(
      `/sessions/${id}/recap`,
      'POST',
      { content: '公开摘要', version: 0 },
      ah,
    );
    expect(
      (
        await req(
          `/sessions/${id}/recap`,
          'POST',
          { content: '旧版', version: 0 },
          ah,
        )
      ).status,
    ).toBe(409);
    await req(`/sessions/${id}/recap`, 'DELETE', undefined, ah);
    expect(
      (await (await req(`/sessions/${id}/recap`, 'GET', undefined, bh)).json())
        .recap,
    ).toBeNull();
    const entry = randomUUID();
    await req(
      '/me/entries',
      'POST',
      {
        id: entry,
        title: '此前独立记录',
        occurredAt: new Date().toISOString(),
        notes: '仅本人',
      },
      bh,
    );
    await req(
      `/me/entries/${entry}`,
      'PATCH',
      { sessionId: id, version: 1 },
      bh,
    );
    expect(
      (await req(`/me/entries/${entry}`, 'GET', undefined, ah)).status,
    ).toBe(404);
    expect(
      (
        await (await req(`/me/activities`, 'GET', undefined, bh)).json()
      ).items.find((x: { id: string }) => x.id === id).entryIds,
    ).toContain(entry);
  });
  it('绑定要求设备确认，禁止跨设备确认、重放和重复绑定', async () => {
    const r = await req('/bindings/challenges', 'POST', {}, dh);
    const ch = await r.json();
    expect(
      (
        await req(
          `/bindings/challenges/${ch.id}/confirm`,
          'POST',
          { confirm: true },
          dh,
        )
      ).status,
    ).toBe(409);
    const claims = await Promise.all([
      req('/bindings/claim', 'POST', { code: ch.code }, ah),
      req('/bindings/claim', 'POST', { code: ch.code }, bh),
    ]);
    expect(claims.map((r) => r.status).sort()).toEqual([200, 409]);
    const winner = claims[0]!.status === 200 ? ah : bh;
    const confirm = await req(
      `/bindings/challenges/${ch.id}/confirm`,
      'POST',
      { confirm: true },
      dh,
    );
    expect(confirm.status).toBe(200);
    const binding = await confirm.json();
    expect(
      (
        await req(
          `/bindings/challenges/${ch.id}/confirm`,
          'POST',
          { confirm: true },
          dh,
        )
      ).status,
    ).toBe(409);
    expect(
      (await req('/bindings/claim', 'POST', { code: ch.token }, winner)).status,
    ).toBe(409);
    await req(`/bindings/${binding.id}`, 'DELETE', undefined, dh);
  });
  it('摘要私有同步、字段白名单、全文授权、删除防复活及解绑', async () => {
    const { binding } = await bind();
    const localSessionId = randomUUID();
    const payload = {
      bindingId: binding.id,
      localSessionId,
      sessionId: legacy,
      title: '私人结果',
      sourceVersion: 'v1',
      version: 0,
      fields: ['summary'],
      content: { summary: '私人分析' },
    };
    expect(
      (await req('/me/private-ai', 'PUT', { ...payload, apiKey: '禁止' }, dh))
        .status,
    ).toBe(400);
    expect(
      (
        await req(
          '/me/private-ai',
          'PUT',
          { ...payload, content: { summary: 'a', transcript: [] } },
          dh,
        )
      ).status,
    ).toBe(400);
    const r = await req('/me/private-ai', 'PUT', payload, dh);
    expect(r.status).toBe(200);
    const result = await r.json();
    expect(
      await (
        await req(
          `/me/private-ai/state/${localSessionId}`,
          'GET',
          undefined,
          dh,
        )
      ).json(),
    ).toMatchObject({
      sourceVersion: 'v1',
      deleted: false,
      fields: ['summary'],
    });
    expect(
      (
        await req(
          `/me/private-ai/state/${localSessionId}`,
          'GET',
          undefined,
          bh,
        )
      ).status,
    ).toBe(403);
    expect(
      'content' in
        (await (
          await req(
            `/me/private-ai/state/${localSessionId}`,
            'GET',
            undefined,
            dh,
          )
        ).json()),
    ).toBe(false);
    expect(
      await (await req('/me/private-ai', 'GET', undefined, bh)).json(),
    ).toEqual([]);
    expect((await req('/me/private-ai', 'PUT', payload, bh)).status).toBe(403);
    expect(
      (await (await req('/me/private-ai', 'GET', undefined, ah)).json())[0]
        .content,
    ).toEqual({ summary: '私人分析' });
    const full = {
      ...payload,
      version: 1,
      fields: ['summary', 'transcript'],
      content: {
        summary: '新摘要',
        transcript: [
          { id: 's', speakerId: null, startMs: 0, endMs: 1, text: '全文' },
        ],
      },
    };
    expect((await req('/me/private-ai', 'PUT', full, dh)).status).toBe(200);
    expect(
      (await req('/me/private-ai', 'PUT', { ...payload, version: 2 }, dh))
        .status,
    ).toBe(200);
    expect(
      (await (await req('/me/private-ai', 'GET', undefined, ah)).json())[0]
        .content.transcript,
    ).toBeUndefined();
    await req(`/me/private-ai/${result.id}`, 'DELETE', undefined, ah);
    expect(
      (await req('/me/private-ai', 'PUT', { ...payload, version: 3 }, dh))
        .status,
    ).toBe(409);
    expect(
      await (await req('/me/private-ai', 'GET', undefined, ah)).json(),
    ).toEqual([]);
    expect(
      (await req(`/sessions/${legacy}/participants`, 'GET', undefined, ah))
        .status,
    ).toBe(200);
    await req(`/bindings/${binding.id}`, 'DELETE', undefined, dh);
    expect(
      (await req('/me/private-ai', 'PUT', { ...payload, version: 4 }, dh))
        .status,
    ).toBe(409);
    expect(
      (await req(`/sessions/${legacy}/participants`, 'GET', undefined, ah))
        .status,
    ).toBe(403);
  });
  it('服务端没有录音和照片上传接口，拒绝在私人记录中夹带媒体', async () => {
    expect(
      (
        await req(
          '/me/entries',
          'POST',
          {
            id: randomUUID(),
            title: '本地图片',
            occurredAt: new Date().toISOString(),
            photos: ['base64-media'],
          },
          ah,
        )
      ).status,
    ).toBe(400);
    expect((await req('/me/photos', 'POST', { file: 'test' }, ah)).status).toBe(
      404,
    );
    expect(
      (await req('/recordings', 'POST', { file: 'test' }, dh)).status,
    ).toBe(404);
  });
  it('同一微信可绑定多台设备；单设备撤销不影响其它设备', async () => {
    const d2 = { id: randomUUID(), secret: randomBytes(32).toString('hex') };
    const h2 = {
      'x-installation-id': d2.id,
      'x-installation-secret': d2.secret,
    };
    await req('/installations', 'POST', d2);
    const one = await bind();
    const two = await bind(ah, h2);
    expect(
      (await (await req('/bindings', 'GET', undefined, ah)).json()).bindings,
    ).toHaveLength(2);
    await req(`/bindings/${one.binding.id}`, 'DELETE', undefined, dh);
    expect(
      (await (await req('/bindings', 'GET', undefined, ah)).json()).bindings,
    ).toHaveLength(1);
    await req(`/bindings/${two.binding.id}`, 'DELETE', undefined, h2);
  });
  it('无授权正文注入和超大请求被拒绝', async () => {
    expect(
      (
        await req(
          '/me/entries',
          'POST',
          {
            id: randomUUID(),
            title: 'a',
            occurredAt: new Date().toISOString(),
            apiKey: '禁止',
          },
          ah,
        )
      ).status,
    ).toBe(400);
    expect(
      (await req('/me/entries', 'POST', { notes: 'a'.repeat(150000) }, ah))
        .status,
    ).toBe(413);
  });
  it('过期码、错误设备及猜码限速', async () => {
    const d = { id: randomUUID(), secret: randomBytes(32).toString('hex') };
    const h = { 'x-installation-id': d.id, 'x-installation-secret': d.secret };
    await req('/installations', 'POST', d);
    const ch = await (await req('/bindings/challenges', 'POST', {}, h)).json();
    expect(
      (await req(`/bindings/challenges/${ch.id}`, 'GET', undefined, dh)).status,
    ).toBe(404);
    await connection.sql`UPDATE binding_challenges SET expires_at=now()-interval '1 minute' WHERE id=${ch.id}`;
    expect(
      (await req('/bindings/claim', 'POST', { code: ch.code }, ah)).status,
    ).toBe(409);
    const guess = await login('guess');
    for (let i = 0; i < 10; i++)
      expect(
        (await req('/bindings/claim', 'POST', { code: '000000000000' }, guess))
          .status,
      ).toBe(409);
    expect(
      (await req('/bindings/claim', 'POST', { code: '000000000000' }, guess))
        .status,
    ).toBe(429);
  });
  it('并发迁移幂等，云端不存在任何照片表', async () => {
    await Promise.all([
      migrateCloud(connection.sql),
      migrateCloud(connection.sql),
    ]);
    const [row] =
      await connection.sql`SELECT count(*)::integer AS n FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('personal_photos','object_deletions')`;
    expect(row!.n).toBe(0);
  });
  it('删除本人云端资料撤销旧令牌、保留他人私人记录', async () => {
    const c = await login('delete-me');
    const sid = randomUUID();
    await req(
      '/sessions',
      'POST',
      { id: sid, title: '本人发起', participantVisibility: 'everyone' },
      c,
    );
    await req(
      `/sessions/${sid}/join`,
      'POST',
      { profile: { name: 'B', introduction: '参加' }, saveProfile: false },
      bh,
    );
    const entry = randomUUID();
    await req(
      '/me/entries',
      'POST',
      {
        id: entry,
        title: 'B 的私人记录',
        occurredAt: new Date().toISOString(),
        sessionId: sid,
      },
      bh,
    );
    await req(`/sessions/${sid}/recap`, 'POST', { content: '已发布' }, c);
    expect((await req('/me/data', 'DELETE', undefined, c)).status).toBe(200);
    expect((await req('/me/entries', 'GET', undefined, c)).status).toBe(401);
    expect(
      (await req(`/me/entries/${entry}`, 'GET', undefined, bh)).status,
    ).toBe(200);
    expect(
      (await (await req(`/sessions/${sid}/recap`, 'GET', undefined, bh)).json())
        .recap,
    ).toBeNull();
    expect(
      (
        await req(
          `/sessions/${sid}/join`,
          'POST',
          { profile: { name: 'B', introduction: '参加' }, saveProfile: false },
          bh,
        )
      ).status,
    ).toBe(404);
  });
});
