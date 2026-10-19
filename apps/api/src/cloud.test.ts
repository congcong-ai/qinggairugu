import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID, randomBytes } from 'node:crypto';
import { postgres } from '@pengtou/database';
import { connectDatabase } from '@pengtou/database';
import { migrateCloud } from '../../../packages/database/src/migrate';
import { createCloudApp } from './cloud';
const base = process.env.TEST_DATABASE_URL;
describe.skipIf(!base)('真实 PostgreSQL 共享数据链路', () => {
  const name = `pengtou_test_${randomBytes(6).toString('hex')}`;
  let cleanup: () => Promise<void>;
  let app: ReturnType<typeof createCloudApp>;
  const device = { id: randomUUID(), secret: randomBytes(32).toString('hex') };
  const headers = {
    'x-installation-id': device.id,
    'x-installation-secret': device.secret,
  };
  const id = randomUUID();
  let userHeaders: Record<string, string> = {};
  async function request(
    path: string,
    method = 'GET',
    body?: unknown,
    auth: Record<string, string> = {},
  ) {
    return app.request(path, {
      method,
      headers: { 'content-type': 'application/json', ...auth },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  }
  beforeAll(async () => {
    const admin = postgres(base!, { max: 1 });
    await admin.unsafe(`CREATE DATABASE ${name}`);
    const url = new URL(base!);
    url.pathname = `/${name}`;
    const connection = connectDatabase(url.toString());
    cleanup = async () => {
      await connection.sql.end();
      await admin.unsafe(`DROP DATABASE ${name}`);
      await admin.end();
    };
    await migrateCloud(connection.sql);
    await migrateCloud(connection.sql);
    app = createCloudApp(connection.db, { allowDevAuth: true });
  }, 30000);
  afterAll(async () => {
    await cleanup?.();
  });
  it('创建身份、创建 Session、限制匿名读取参与者', async () => {
    expect((await request('/installations', 'POST', device)).status).toBe(201);
    expect(
      (
        await request('/installations', 'POST', {
          ...device,
          secret: 'f'.repeat(64),
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await request(
          '/sessions',
          'POST',
          { id, title: 'AI 硬件倾盖如故', participantVisibility: 'everyone' },
          headers,
        )
      ).status,
    ).toBe(201);
    expect((await request(`/sessions/${id}/participants`)).status).toBe(403);
    const response = await request('/auth/wechat', 'POST', {
      code: 'dev:test-person',
    });
    const auth = await response.json();
    userHeaders = { authorization: `Bearer ${auth.token}` };
    expect(
      (
        await request(
          `/sessions/${id}/join`,
          'POST',
          {
            profile: { name: 'Peter', introduction: '最近在做 AI 硬件' },
            saveProfile: true,
          },
          userHeaders,
        )
      ).status,
    ).toBe(201);
    expect(
      (
        await (
          await request('/me/profile', 'GET', undefined, userHeaders)
        ).json()
      ).profile.name,
    ).toBe('Peter');
    expect(
      (
        await (
          await request(
            `/sessions/${id}/participants`,
            'GET',
            undefined,
            userHeaders,
          )
        ).json()
      ).length,
    ).toBe(1);
  });
  it('资料复用必须主动加入，快照不被保存资料修改污染', async () => {
    const next = randomUUID();
    await request(
      '/sessions',
      'POST',
      { id: next, title: '另一场', participantVisibility: 'everyone' },
      headers,
    );
    expect(
      (
        await request(
          `/sessions/${next}/participants`,
          'GET',
          undefined,
          userHeaders,
        )
      ).status,
    ).toBe(403);
    await request(
      `/sessions/${next}/join`,
      'POST',
      {
        profile: { name: '本场名字', introduction: '仅本场' },
        saveProfile: false,
      },
      userHeaders,
    );
    expect(
      (
        await (
          await request('/me/profile', 'GET', undefined, userHeaders)
        ).json()
      ).profile.name,
    ).toBe('Peter');
    await request('/me/profile', 'DELETE', undefined, userHeaders);
    expect(
      (
        await (
          await request('/me/profile', 'GET', undefined, userHeaders)
        ).json()
      ).profile,
    ).toBeNull();
    expect(
      (
        await (
          await request(
            `/sessions/${id}/participants`,
            'GET',
            undefined,
            headers,
          )
        ).json()
      )[0].profile.name,
    ).toBe('Peter');
    expect(
      (
        await (
          await request('/me/sessions', 'GET', undefined, userHeaders)
        ).json()
      ).length,
    ).toBe(2);
  });
  it('可见范围在服务端执行，回顾必须由主办方明确发布', async () => {
    expect(
      (
        await (
          await request(`/sessions/${id}/recap`, 'GET', undefined, userHeaders)
        ).json()
      ).recap,
    ).toBeNull();
    expect(
      (
        await request(
          `/sessions/${id}/recap`,
          'POST',
          { content: '不允许' },
          userHeaders,
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await request(
          `/sessions/${id}`,
          'PATCH',
          { participantVisibility: 'organizer_only' },
          headers,
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await request(
          `/sessions/${id}/participants`,
          'GET',
          undefined,
          userHeaders,
        )
      ).status,
    ).toBe(403);
    expect(
      (await request(`/sessions/${id}/participants`, 'GET', undefined, headers))
        .status,
    ).toBe(200);
    expect(
      (
        await request(
          `/sessions/${id}/recap`,
          'POST',
          { content: '大家聊了 AI 硬件。', transcript: '禁止上传' },
          headers,
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await request(
          `/sessions/${id}/recap`,
          'POST',
          { content: '大家聊了 AI 硬件。' },
          headers,
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await (
          await request(`/sessions/${id}/recap`, 'GET', undefined, userHeaders)
        ).json()
      ).recap.content,
    ).toBe('大家聊了 AI 硬件。');
    expect((await request(`/sessions/${id}/recap`)).status).toBe(403);
  });
});
