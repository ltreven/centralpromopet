import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

const configuredConnectionString = process.env.DATABASE_URL;

if (!configuredConnectionString) {
  throw new Error('DATABASE_URL is required');
}
const connectionString: string = configuredConnectionString;

const migrationsFolder =
  process.env.MIGRATIONS_FOLDER ?? '/app/packages/database/drizzle';
const maxAttempts = 30;
const retryDelayMs = 1_000;
const sleep = (milliseconds: number) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

async function runMigrations() {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const readinessClient = postgres(connectionString, { max: 1 });
    try {
      await readinessClient`select 1`;
      await readinessClient.end();
      break;
    } catch (error) {
      await readinessClient.end().catch(() => undefined);
      if (attempt === maxAttempts) throw error;
      await sleep(retryDelayMs);
    }
  }

  const client = postgres(connectionString, { max: 1 });
  try {
    await migrate(drizzle(client), { migrationsFolder });
    console.log('Database migrations completed.');
  } finally {
    await client.end();
  }
}

runMigrations().catch((error) => {
  console.error('Database migration failed:', error);
  process.exit(1);
});
