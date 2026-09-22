import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db, users } from '@centralpromopet/database';
import { AuthenticatedRequest, requireAdmin, requireAuth, requireCurrentPassword } from '../auth';
import { logActivity } from '../activity';

export const adminUsersRouter = Router();
const password = z.string().min(12).refine((value) => Buffer.byteLength(value, 'utf8') <= 72);
const createUserSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(255),
  displayName: z.string().trim().min(1).max(100),
  temporaryPassword: password,
  role: z.enum(['admin', 'user']),
}).strict();
const updateUserSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(255),
  displayName: z.string().trim().min(1).max(100),
  role: z.enum(['admin', 'user']),
  status: z.enum(['active', 'inactive']),
}).strict();
const userIdSchema = z.string().uuid();

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
    await logActivity({ userId: (req as AuthenticatedRequest).user.id, event: 'admin.user.create', entityType: 'user', entityId: created.id, details: { role: created.role } });
    res.status(201).json({ success: true, data: created });
  } catch (error) { next(error); }
});

adminUsersRouter.patch('/:id', requireAuth, requireCurrentPassword, requireAdmin, async (req, res, next) => {
  const id = userIdSchema.safeParse(req.params.id);
  if (!id.success) return res.status(400).json({ success: false, message: 'Identificador de usuário inválido.' });
  const parsed = updateUserSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, message: parsed.error.issues[0]?.message || 'Confira os dados do usuário.' });
  try {
    const [updated] = await db.update(users).set({ ...parsed.data, updatedAt: new Date() }).where(eq(users.id, id.data)).returning({
      id: users.id, email: users.email, displayName: users.displayName, role: users.role, status: users.status,
      passwordExpired: users.passwordExpired, createdAt: users.createdAt,
    });
    if (!updated) return res.status(404).json({ success: false, message: 'Usuário não encontrado.' });
    await logActivity({ userId: (req as AuthenticatedRequest).user.id, event: 'admin.user.update', entityType: 'user', entityId: updated.id, details: { role: updated.role, status: updated.status } });
    res.json({ success: true, data: updated });
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'code' in error && error.code === '23505') return res.status(409).json({ success: false, message: 'Já existe um usuário com esse e-mail.' });
    next(error);
  }
});
