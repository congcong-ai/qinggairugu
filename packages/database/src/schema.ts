import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  primaryKey,
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
  organizerId: uuid('organizer_id')
    .notNull()
    .references(() => installations.id),
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
  sessionId: uuid('session_id')
    .primaryKey()
    .references(() => sessions.id, { onDelete: 'cascade' }),
  content: text().notNull(),
  publishedAt: timestamp('published_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});
