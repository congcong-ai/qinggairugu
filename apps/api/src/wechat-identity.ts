import { randomUUID } from 'node:crypto';
import { type Database, schema, eq, and, sql } from '@pengtou/database';
export class IdentityConflict extends Error {}
// 调用方必须先在微信服务端验证 code，不能传入客户端自报身份。
export async function resolveWechatIdentity(
  db: Database,
  input: {
    appId: string;
    openid: string;
    unionid?: string;
    platformId?: string;
    legacyMiniapp: boolean;
  },
) {
  return db.transaction(async (tx) => {
    // 登录事务很短；统一锁同时保护首次登录、旧账号接续与跨端并发。
    await tx.execute(sql`SELECT pg_advisory_xact_lock(706568675)`);
    const [identity] = await tx
      .select()
      .from(schema.wechatIdentities)
      .where(
        and(
          eq(schema.wechatIdentities.appId, input.appId),
          eq(schema.wechatIdentities.openid, input.openid),
        ),
      );
    const [legacy] = input.legacyMiniapp
      ? await tx
          .select()
          .from(schema.users)
          .where(eq(schema.users.openid, input.openid))
      : [];
    const [union] =
      input.unionid && input.platformId
        ? await tx
            .select()
            .from(schema.wechatUnions)
            .where(
              and(
                eq(schema.wechatUnions.platformId, input.platformId),
                eq(schema.wechatUnions.unionid, input.unionid),
              ),
            )
        : [];
    const existingId = identity?.userId ?? legacy?.id;
    if (existingId && union && existingId !== union.userId)
      throw new IdentityConflict('两个已有账号需要单独核验，不能自动合并');
    const userId = existingId ?? union?.userId ?? randomUUID();
    if (!existingId && !union)
      await tx.insert(schema.users).values({
        id: userId,
        openid: input.legacyMiniapp ? input.openid : null,
      });
    if (!identity)
      await tx
        .insert(schema.wechatIdentities)
        .values({ appId: input.appId, openid: input.openid, userId });
    if (input.unionid && input.platformId && !union)
      await tx.insert(schema.wechatUnions).values({
        platformId: input.platformId,
        unionid: input.unionid,
        userId,
      });
    return userId;
  });
}
