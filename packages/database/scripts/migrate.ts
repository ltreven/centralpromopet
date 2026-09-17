import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

const connectionString =
  process.env.DATABASE_URL ??
  'postgres://centralpromopet:centralpromopet@127.0.0.1:5433/centralpromopet';

const maxAttempts = 30;
const retryDelayMs = 1_000;

const sleep = (milliseconds: number) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

async function runMigrations() {
  console.log('🛠️ [Database] Waiting for PostgreSQL...');

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const readinessClient = postgres(connectionString, { max: 1 });

    try {
      await readinessClient`select 1`;
      await readinessClient.end();
      break;
    } catch (error) {
      await readinessClient.end().catch(() => undefined);

      if (attempt === maxAttempts) {
        throw error;
      }

      console.log(
        `⏳ PostgreSQL not ready (attempt ${attempt}/${maxAttempts}); retrying...`,
      );
      await sleep(retryDelayMs);
    }
  }

  const migrationClient = postgres(connectionString, { max: 1 });

  try {
    console.log('🛠️ [Database] Running migrations...');
    await migrate(drizzle(migrationClient), { migrationsFolder: './drizzle' });
    console.log('✅ Database migrations completed.');
  } finally {
    await migrationClient.end();
  }
}

runMigrations().catch((error) => {
  console.error('❌ Database migration failed:', error);
  process.exit(1);
});
