import { type Database, schema, eq, and, isNull, or } from '@pengtou/database';
export type Actor =
  { kind: 'device'; id: string } | { kind: 'user'; id: string };
export async function activeBinding(
  db: Pick<Database, 'select'>,
  actor: Actor | null,
) {
  if (!actor || actor.kind !== 'device') return null;
  return (
    (
      await db
        .select()
        .from(schema.bindings)
        .where(
          and(
            eq(schema.bindings.installationId, actor.id),
            isNull(schema.bindings.revokedAt),
          ),
        )
    )[0] ?? null
  );
}
export async function userIdFor(
  db: Pick<Database, 'select'>,
  actor: Actor | null,
) {
  return actor?.kind === 'user'
    ? actor.id
    : ((await activeBinding(db, actor))?.userId ?? null);
}
export async function sessionAccess(
  db: Pick<Database, 'select'>,
  id: string,
  actor: Actor | null,
) {
  const session = (
    await db.select().from(schema.sessions).where(eq(schema.sessions.id, id))
  )[0];
  if (!session) return { session, organizer: false, member: false };
  const userId = await userIdFor(db, actor);
  const deviceBindings = userId
    ? await db
        .select()
        .from(schema.bindings)
        .where(
          and(
            eq(schema.bindings.userId, userId),
            isNull(schema.bindings.revokedAt),
          ),
        )
    : [];
  const organizer =
    !!actor &&
    ((actor.kind === 'device' && session.organizerId === actor.id) ||
      (!!userId &&
        (session.organizerUserId === userId ||
          deviceBindings.some(
            (b) => b.installationId === session.organizerId,
          ))));
  const membership = userId
    ? (
        await db
          .select()
          .from(schema.participants)
          .where(
            and(
              eq(schema.participants.sessionId, id),
              eq(schema.participants.userId, userId),
            ),
          )
      )[0]
    : null;
  return { session, organizer, member: !!membership };
}
export async function activitySessions(
  db: Pick<Database, 'select'>,
  actor: Actor,
) {
  const uid = await userIdFor(db, actor);
  const bindings = uid
    ? await db
        .select()
        .from(schema.bindings)
        .where(
          and(
            eq(schema.bindings.userId, uid),
            isNull(schema.bindings.revokedAt),
          ),
        )
    : [];
  const clauses = [
    ...(actor.kind === 'device'
      ? [eq(schema.sessions.organizerId, actor.id)]
      : []),
    ...bindings.map((b) => eq(schema.sessions.organizerId, b.installationId)),
    ...(uid ? [eq(schema.sessions.organizerUserId, uid)] : []),
  ];
  const owned = clauses.length
    ? await db
        .select()
        .from(schema.sessions)
        .where(or(...clauses))
    : [];
  const joined = uid
    ? await db
        .select({ session: schema.sessions })
        .from(schema.participants)
        .innerJoin(
          schema.sessions,
          eq(schema.participants.sessionId, schema.sessions.id),
        )
        .where(eq(schema.participants.userId, uid))
    : [];
  return { owned, joined: joined.map((r) => r.session), uid };
}
