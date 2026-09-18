import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

if (process.env.NODE_ENV === 'production' && !process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required in production');
}
export const client = postgres(process.env.DATABASE_URL || 'postgres://centralpromopet:centralpromopet@127.0.0.1:5433/centralpromopet');
export const db = drizzle(client, { schema });
export * from './schema';
export * from './demo-promotions';
