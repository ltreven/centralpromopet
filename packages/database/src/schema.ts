import { boolean, integer, pgEnum, pgTable, timestamp, uuid, varchar, text, index, check, jsonb } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const userRole = pgEnum('user_role', ['admin', 'user']);
export const userStatus = pgEnum('user_status', ['active', 'inactive']);
export const promotionStatus = pgEnum('promotion_status', ['draft', 'published']);
export const promotionPetType = pgEnum('promotion_pet_type', ['dogs', 'cats', 'birds', 'other']);
export const petType = pgEnum('pet_type', ['dogs', 'cats', 'birds', 'other']);
export const tipCategory = pgEnum('tip_category', ['wellness', 'training']);
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
  receiveNewsletter: boolean('receive_newsletter').default(false).notNull(),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => ({
  hasLoginMethod: check('users_has_login_method', sql`${table.passwordHash} IS NOT NULL OR ${table.googleSubject} IS NOT NULL`),
}));

export const pets = pgTable('pets', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 80 }).notNull(),
  type: petType('type').notNull(),
  breed: varchar('breed', { length: 100 }),
  birthMonth: integer('birth_month'),
  birthYear: integer('birth_year'),
  receiveUpdates: boolean('receive_updates').default(false).notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => ({
  userIdx: index('pets_user_idx').on(table.userId),
  validBirthMonth: check('pets_valid_birth_month', sql`${table.birthMonth} IS NULL OR (${table.birthMonth} BETWEEN 1 AND 12)`),
  validBirthYear: check('pets_valid_birth_year', sql`${table.birthYear} IS NULL OR (${table.birthYear} BETWEEN 1900 AND 2100)`),
  completeBirthDate: check('pets_complete_birth_date', sql`(${table.birthMonth} IS NULL AND ${table.birthYear} IS NULL) OR (${table.birthMonth} IS NOT NULL AND ${table.birthYear} IS NOT NULL)`),
}));

export const tips = pgTable('tips', {
  id: uuid('id').defaultRandom().primaryKey(),
  title: varchar('title', { length: 200 }).notNull(),
  content: text('content').notNull(),
  category: tipCategory('category').notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => ({
  categoryIdx: index('tips_category_idx').on(table.category),
}));

export const googleLoginChallenges = pgTable('google_login_challenges', {
  nonceHash: varchar('nonce_hash', { length: 64 }).primaryKey(),
  purpose: varchar('purpose', { length: 10 }).notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
}, (table) => ({ expiryIdx: index('google_login_challenges_expiry_idx').on(table.expiresAt) }));

export const aiSettings = pgTable('ai_settings', {
  id: integer('id').primaryKey().default(1),
  config: jsonb('config').$type<Record<string, unknown>>().notNull(),
  updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
  updatedAt: updatedAt(),
});
export const aiAudit = pgTable('ai_audit', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  event: varchar('event', { length: 80 }).notNull(),
  details: jsonb('details').$type<Record<string, unknown>>().notNull(),
  createdAt: createdAt(),
});
export const chatThreads = pgTable('chat_threads', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 100 }).notNull().default('Nova conversa'),
  summary: text('summary').notNull().default(''),
  createdAt: createdAt(), updatedAt: updatedAt(),
}, (t) => ({ userIdx: index('chat_threads_user_idx').on(t.userId, t.updatedAt) }));
export const chatMessages = pgTable('chat_messages', {
  id: uuid('id').defaultRandom().primaryKey(),
  threadId: uuid('thread_id').notNull().references(() => chatThreads.id, { onDelete: 'cascade' }),
  role: varchar('role', { length: 20 }).notNull(),
  content: text('content').notNull(),
  promotionIds: jsonb('promotion_ids').$type<string[]>().notNull().default([]),
  createdAt: createdAt(),
}, (t) => ({ threadIdx: index('chat_messages_thread_idx').on(t.threadId, t.createdAt) }));
export const aiMemories = pgTable('ai_memories', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  petId: uuid('pet_id').notNull().references(() => pets.id, { onDelete: 'cascade' }),
  content: varchar('content', { length: 600 }).notNull(),
  sourceQuote: varchar('source_quote', { length: 600 }).notNull(),
  category: varchar('category', { length: 30 }).notNull(),
  createdAt: createdAt(),
}, (t) => ({ userIdx: index('ai_memories_user_idx').on(t.userId, t.petId) }));
export const aiActions = pgTable('ai_actions', {
  id: uuid('id').defaultRandom().primaryKey(),
  threadId: uuid('thread_id').notNull().references(() => chatThreads.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
  label: text('label').notNull(),
  status: varchar('status', { length: 20 }).notNull().default('pending'),
  createdAt: createdAt(),
});
export const aiUsage = pgTable('ai_usage', {
  id: varchar('id', { length: 80 }).primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  requests: integer('requests').notNull().default(0),
});

export const promotions = pgTable('promotions', {
  id: uuid('id').defaultRandom().primaryKey(),
  title: varchar('title', { length: 200 }).notNull(),
  description: text('description'),
  imageUrl: text('image_url'),
  store: varchar('store', { length: 100 }).notNull(),
  currency: varchar('currency', { length: 3 }).default('BRL').notNull(),
  coupon: varchar('coupon', { length: 100 }),
  storeVerified: boolean('store_verified').default(false).notNull(),
  petTypes: promotionPetType('pet_types').array().default(sql`ARRAY['other']::promotion_pet_type[]`).notNull(),
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
