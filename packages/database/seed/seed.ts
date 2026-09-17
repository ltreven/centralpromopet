import bcrypt from 'bcryptjs';
import { client, db, users } from '../src';

async function seed() {
  if (process.env.NODE_ENV === 'production') throw new Error('Local seed is disabled in production. Use the bootstrap admin Job.');
  await db.insert(users).values({
    email: 'admin@centralpromopet.local',
    passwordHash: await bcrypt.hash('CentralPet-local-2026!', 12),
    passwordExpired: true,
    role: 'admin',
  }).onConflictDoNothing({ target: users.email });
  console.log('Local administrator ready. Existing passwords are never overwritten.');
}
seed().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => client.end());
