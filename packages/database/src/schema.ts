import { boolean, integer, pgEnum, pgTable, timestamp, uuid, varchar, text, index, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const userRole = pgEnum('user_role', ['admin', 'user']);
export const userStatus = pgEnum('user_status', ['active', 'inactive']);
export const promotionStatus = pgEnum('promotion_status', ['draft', 'published']);
const createdAt = () => timestamp('created_at', { withTimezone: true }).defaultNow().notNull();
const updatedAt = () => timestamp('updated_at', { withTimezone: true }).defaultNow().notNull();

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }),
  googleSubject: varchar('google_subject', { length: 255 }).unique(),
  googleEmail: varchar('google_email', { length: 255 }),
  displayName: varchar('display_name', { length: 100 }),
  avatarUrl: text('avatar_url'),
  passwordExpired: boolean('password_expired').default(true).notNull(),
  sessionVersion: integer('session_version').default(0).notNull(),
  role: userRole('role').default('user').notNull(),
  status: userStatus('status').default('active').notNull(),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => ({
  hasLoginMethod: check('users_has_login_method', sql`${table.passwordHash} IS NOT NULL OR ${table.googleSubject} IS NOT NULL`),
}));

export const googleLoginChallenges = pgTable('google_login_challenges', {
  nonceHash: varchar('nonce_hash', { length: 64 }).primaryKey(),
  purpose: varchar('purpose', { length: 10 }).notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
}, (table) => ({ expiryIdx: index('google_login_challenges_expiry_idx').on(table.expiresAt) }));

export const promotions = pgTable('promotions', {
  id: uuid('id').defaultRandom().primaryKey(),
  title: varchar('title', { length: 200 }).notNull(),
  description: text('description'),
  imageUrl: text('image_url'),
  store: varchar('store', { length: 100 }).notNull(),
  priceCents: integer('price_cents').notNull(),
  originalPriceCents: integer('original_price_cents'),
  affiliateUrl: text('affiliate_url').notNull(),
  startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
  endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
  status: promotionStatus('status').default('draft').notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => ({
  activeIdx: index('promotions_active_idx').on(table.status, table.startsAt, table.endsAt),
  validPeriod: check('promotions_valid_period', sql`${table.endsAt} > ${table.startsAt}`),
  positivePrice: check('promotions_positive_price', sql`${table.priceCents} > 0`),
  originalPrice: check('promotions_original_price', sql`${table.originalPriceCents} IS NULL OR ${table.originalPriceCents} >= ${table.priceCents}`),
}));
