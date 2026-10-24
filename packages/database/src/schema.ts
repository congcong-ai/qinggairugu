import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  primaryKey,
  integer,
} from 'drizzle-orm/pg-core';
import type { Profile } from '@pengtou/contracts';
export const installations = pgTable('installations', {
  id: uuid().primaryKey(),
  secretHash: text('secret_hash').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});
export const users = pgTable('users', {
  id: uuid().primaryKey(),
  openid: text().notNull().unique(),
  profile: jsonb().$type<Profile>(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});
export const tokens = pgTable('auth_tokens', {
  hash: text().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
});
export const sessions = pgTable('sessions', {
  id: uuid().primaryKey(),
  organizerId: uuid('organizer_id').references(() => installations.id),
  organizerUserId: uuid('organizer_user_id').references(() => users.id),
  location: text(),
  category: text(),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
  title: text().notNull(),
  startsAt: timestamp('starts_at', { withTimezone: true }),
  participantVisibility: text('participant_visibility')
    .$type<'everyone' | 'organizer_only'>()
    .notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});
export const participants = pgTable(
  'participants',
  {
    sessionId: uuid('session_id')
      .notNull()
      .references(() => sessions.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    profile: jsonb().$type<Profile>().notNull(),
    joinedAt: timestamp('joined_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [primaryKey({ columns: [t.sessionId, t.userId] })],
);
export const recaps = pgTable('recaps', {
  version: integer().notNull().default(1),
  withdrawnAt: timestamp('withdrawn_at', { withTimezone: true }),
  sessionId: uuid('session_id')
    .primaryKey()
    .references(() => sessions.id, { onDelete: 'cascade' }),
  content: text().notNull(),
  publishedAt: timestamp('published_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const bindings = pgTable('app_bindings', {
  id: uuid().primaryKey(),
  installationId: uuid('installation_id')
    .notNull()
    .references(() => installations.id),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
});
export const challenges = pgTable('binding_challenges', {
  id: uuid().primaryKey(),
  installationId: uuid('installation_id')
    .notNull()
    .references(() => installations.id),
  tokenHash: text('token_hash').notNull(),
  codeHash: text('code_hash').notNull(),
  claimedUserId: uuid('claimed_user_id').references(() => users.id),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  consumedAt: timestamp('consumed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});
export const entries = pgTable('personal_entries', {
  id: uuid().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id),
  sessionId: uuid('session_id').references(() => sessions.id),
  title: text().notNull(),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
  location: text().notNull().default(''),
  category: text().notNull().default(''),
  notes: text().notNull().default(''),
  people: jsonb()
    .$type<{ name: string; note: string }[]>()
    .notNull()
    .default([]),
  version: integer().notNull().default(1),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});
export const privateAI = pgTable('private_ai_results', {
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  id: uuid().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id),
  bindingId: uuid('binding_id')
    .notNull()
    .references(() => bindings.id),
  localSessionId: uuid('local_session_id').notNull(),
  sessionId: uuid('session_id').references(() => sessions.id),
  title: text().notNull(),
  sourceVersion: text('source_version').notNull(),
  version: integer().notNull().default(1),
  fields: jsonb().$type<string[]>().notNull(),
  content: jsonb().$type<Record<string, unknown>>().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});
export const privacyAudit = pgTable('privacy_audit', {
  id: uuid().primaryKey(),
  actorId: text('actor_id').notNull(),
  action: text().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});
