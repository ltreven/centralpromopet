import bcrypt from 'bcryptjs';
import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { client, db, users } from '@centralpromopet/database';

async function bootstrap() {
  const email = z.string().trim().toLowerCase().email().max(255).parse(process.env.BOOTSTRAP_ADMIN_EMAIL);
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  if (!password || password.length < 12 || Buffer.byteLength(password, 'utf8') > 72) throw new Error('Bootstrap password must have at least 12 characters and at most 72 UTF-8 bytes');
  const passwordHash = await bcrypt.hash(password, 12);
  await db.transaction(async (tx) => {
    // Serialize concurrent bootstrap jobs so only one first administrator can be created.
    await tx.execute(sql`select pg_advisory_xact_lock(19374021)`);
    const [existingAdmin] = await tx.select({ id: users.id }).from(users).where(eq(users.role, 'admin')).limit(1);
    if (existingAdmin) throw new Error('An administrator already exists; bootstrap is disabled');
    await tx.insert(users).values({ email, passwordHash, passwordExpired: true, role: 'admin', status: 'active' });
  });
  console.log('Administrator created with mandatory password change.');
}
bootstrap().catch((error) => { console.error(error instanceof Error ? error.message : 'Bootstrap failed'); process.exitCode = 1; }).finally(() => client.end());
