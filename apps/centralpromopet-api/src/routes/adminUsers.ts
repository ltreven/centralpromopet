import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { desc } from 'drizzle-orm';
import { z } from 'zod';
import { db, users } from '@centralpromopet/database';
import { requireAdmin, requireAuth, requireCurrentPassword } from '../auth';

export const adminUsersRouter = Router();
const password = z.string().min(12).refine((value) => Buffer.byteLength(value, 'utf8') <= 72);
const createUserSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(255),
  displayName: z.string().trim().min(1).max(100),
  temporaryPassword: password,
  role: z.enum(['admin', 'user']),
}).strict();

adminUsersRouter.get('/', requireAuth, requireCurrentPassword, requireAdmin, async (_req, res, next) => {
  try {
    const data = await db.select({
      id: users.id,
      email: users.email,
      displayName: users.displayName,
      role: users.role,
      status: users.status,
      passwordExpired: users.passwordExpired,
      createdAt: users.createdAt,
    }).from(users).orderBy(desc(users.createdAt)).limit(200);
    res.setHeader('Cache-Control', 'no-store');
    res.json({ success: true, data });
  } catch (error) { next(error); }
});

adminUsersRouter.post('/', requireAuth, requireCurrentPassword, requireAdmin, async (req, res, next) => {
  const parsed = createUserSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, message: parsed.error.issues[0]?.message || 'Confira os dados do usuário.' });
  try {
    const value = parsed.data;
    const [created] = await db.insert(users).values({
      email: value.email,
      displayName: value.displayName,
      passwordHash: await bcrypt.hash(value.temporaryPassword, 12),
      passwordExpired: true,
      role: value.role,
      status: 'active',
    }).onConflictDoNothing({ target: users.email }).returning({
      id: users.id,
      email: users.email,
      displayName: users.displayName,
      role: users.role,
      status: users.status,
      passwordExpired: users.passwordExpired,
      createdAt: users.createdAt,
    });
    if (!created) return res.status(409).json({ success: false, message: 'Já existe um usuário com esse e-mail.' });
    res.status(201).json({ success: true, data: created });
  } catch (error) { next(error); }
});
