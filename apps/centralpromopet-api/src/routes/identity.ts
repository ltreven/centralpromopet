import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { eq, sql } from 'drizzle-orm';
import { db, users } from '@centralpromopet/database';
import { AuthenticatedRequest, clearSessionCookie, createSessionToken, requireAuth, requireCurrentPassword, sessionCookie, publicUser } from '../auth';
import { logActivity } from '../activity';

import { createGoogleRouter } from './google';
import { GoogleVerifier } from '../google';

export function createIdentityRouter(googleVerifier?: GoogleVerifier) {
const identityRouter = Router();
const password = z.string().min(12).refine((value) => Buffer.byteLength(value, 'utf8') <= 72, 'Use no máximo 72 bytes para a senha.');
const loginSchema = z.object({ email: z.string().trim().toLowerCase().email().max(255), password: z.string().min(1).max(256) });
const changeSchema = z.object({ oldPassword: z.string().min(1).max(256), newPassword: password }).refine((input) => input.oldPassword !== input.newPassword, 'Escolha uma senha diferente da atual.');
const preferencesSchema = z.object({ receiveNewsletter: z.boolean() });
// Per-process protection. API is private behind the Web proxy; the shared limit
// intentionally does not trust client-supplied forwarding headers.
const attempts = new Map<string, { count: number; resetAt: number }>();
identityRouter.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST' || !['/login', '/change-password', '/google', '/google/link', '/google/challenge', '/google/link/challenge'].includes(req.path)) return next();
  const now = Date.now();
  for (const [key, entry] of attempts) if (entry.resetAt <= now) attempts.delete(key);
  const key = req.socket.remoteAddress || 'unknown';
  const entry = attempts.get(key) || { count: 0, resetAt: now + 60000 };
  attempts.set(key, entry);
  if (++entry.count > 30) {
    res.setHeader('Retry-After', Math.ceil((entry.resetAt - now) / 1000));
    return res.status(429).json({ success: false, message: 'Muitas tentativas. Aguarde um minuto.' });
  }
  next();
});
const dummyHash = bcrypt.hashSync('invalid-account-placeholder', 12);
identityRouter.post('/login', async (req, res, next) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, message: 'Informe um e-mail e uma senha válidos.' });
  try {
    const [user] = await db.select().from(users).where(eq(users.email, parsed.data.email));
    const matches = await bcrypt.compare(parsed.data.password, user?.passwordHash || dummyHash);
    if (!user || user.status !== 'active' || !user.passwordHash || !matches) return res.status(401).json({ success: false, message: 'E-mail ou senha inválidos.' });
    await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));
    void logActivity({ userId: user.id, event: 'user.login', entityType: 'user', entityId: user.id });
    res.setHeader('Set-Cookie', sessionCookie(createSessionToken(user)));
    res.json({ success: true, data: { user: publicUser(user) } });
  } catch (error) { next(error); }
});
identityRouter.post('/logout', (_req, res) => {
  res.setHeader('Set-Cookie', clearSessionCookie());
  res.json({ success: true });
});
identityRouter.get('/me', requireAuth, (req, res) => res.json({ success: true, data: (req as AuthenticatedRequest).user }));
identityRouter.patch('/preferences', requireAuth, requireCurrentPassword, async (req, res, next) => {
  const parsed = preferencesSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, message: 'Preferências inválidas.' });
  try {
    const userId = (req as AuthenticatedRequest).user.id;
    const [updated] = await db.update(users).set({ receiveNewsletter: parsed.data.receiveNewsletter, updatedAt: new Date() }).where(eq(users.id, userId)).returning();
    void logActivity({ userId, event: 'user.preferences.update', entityType: 'user', entityId: userId, details: { receiveNewsletter: parsed.data.receiveNewsletter } });
    res.json({ success: true, data: publicUser(updated) });
  } catch (error) { next(error); }
});
identityRouter.post('/change-password', requireAuth, async (req, res, next) => {
  const parsed = changeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, message: 'Use uma nova senha diferente, com pelo menos 12 caracteres e no máximo 72 bytes.' });
  try {
    const userId = (req as AuthenticatedRequest).user.id;
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user || !user.passwordHash || !(await bcrypt.compare(parsed.data.oldPassword, user.passwordHash))) return res.status(400).json({ success: false, message: 'Senha atual incorreta.' });
    const [updated] = await db.update(users).set({ passwordHash: await bcrypt.hash(parsed.data.newPassword, 12), passwordExpired: false, sessionVersion: sql`${users.sessionVersion} + 1`, updatedAt: new Date() }).where(eq(users.id, userId)).returning();
    void logActivity({ userId, event: 'user.password.change', entityType: 'user', entityId: userId });
    res.setHeader('Set-Cookie', sessionCookie(createSessionToken(updated)));
    res.json({ success: true });
  } catch (error) { next(error); }
});

identityRouter.use('/google', createGoogleRouter(googleVerifier));
return identityRouter;
}
