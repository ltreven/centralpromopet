import { createHash, randomBytes } from 'node:crypto';
import { Router, Request } from 'express';
import { and, eq, gt, lt, sql } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { db, googleLoginChallenges, users } from '@centralpromopet/database';
import { AuthenticatedRequest, createSessionToken, publicUser, requireAuth, requireCurrentPassword, sessionCookie } from '../auth';
import { googleClientId, GoogleVerifier, verifyGoogleCredential } from '../google';
import { logActivity } from '../activity';

type Purpose = 'login' | 'link';
const ttlSeconds = 600;
const cookieName = (purpose: Purpose) => `centralpromopet_google_${purpose}`;
const hash = (nonce: string) => createHash('sha256').update(nonce).digest('hex');
function configuredAdminEmails() {
  return new Set((process.env.ADMIN_EMAILS || '').split(',').map((email) => email.trim().toLowerCase()).filter(Boolean));
}
function challengeCookie(purpose: Purpose, nonce: string, clear = false) {
  return `${cookieName(purpose)}=${nonce}; HttpOnly; SameSite=Lax; Path=/api/identity/google; Max-Age=${clear ? 0 : ttlSeconds}${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`;
}
function requestNonce(req: Request, purpose: Purpose) {
  return req.headers.cookie?.split(';').map((part) => part.trim().split('=')).find(([name]) => name === cookieName(purpose))?.[1];
}
class GoogleLoginError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}
const invalidChallenge = () => new GoogleLoginError(401, 'GOOGLE_CHALLENGE_EXPIRED', 'Este acesso expirou. Tente entrar com Google novamente.');
const loginSchema = z.object({ credential: z.string().min(1).max(12000) }).strict();
const linkSchema = loginSchema.extend({ password: z.string().min(1).max(256) }).strict();

export function createGoogleRouter(verifier: GoogleVerifier = verifyGoogleCredential) {
  const router = Router();
  router.get('/config', (_req, res) => {
    const clientId = googleClientId();
    res.json({ success: true, data: { enabled: Boolean(clientId), clientId: clientId || null, oneTapEnabled: Boolean(clientId) && process.env.GOOGLE_ONE_TAP_ENABLED !== 'false' } });
  });
  router.use((_req, res, next) => {
    if (!googleClientId()) return res.status(503).json({ success: false, code: 'GOOGLE_DISABLED', message: 'O login com Google ainda não está disponível.' });
    next();
  });

  for (const purpose of ['login', 'link'] as const) {
    const path = purpose === 'login' ? '' : '/link';
    const guards = purpose === 'link' ? [requireAuth, requireCurrentPassword] : [];
    router.post(`${path}/challenge`, ...guards, async (req, res, next) => {
      try {
        const nonce = randomBytes(32).toString('base64url');
        const userId = purpose === 'link' ? (req as AuthenticatedRequest).user.id : null;
        await db.delete(googleLoginChallenges).where(lt(googleLoginChallenges.expiresAt, new Date()));
        await db.insert(googleLoginChallenges).values({ nonceHash: hash(nonce), purpose, userId, expiresAt: new Date(Date.now() + ttlSeconds * 1000) });
        res.setHeader('Set-Cookie', challengeCookie(purpose, nonce));
        res.json({ success: true, data: { nonce } });
      } catch (error) { next(error); }
    });
    router.post(path || '/', ...guards, async (req, res, next) => {
      const parsed = (purpose === 'link' ? linkSchema : loginSchema).safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ success: false, message: 'Não foi possível validar os dados do login com Google.' });
      const nonce = requestNonce(req, purpose);
      try {
        if (!nonce || !/^[\w-]{43}$/.test(nonce)) throw invalidChallenge();
        const challengeFilter = and(eq(googleLoginChallenges.nonceHash, hash(nonce)), eq(googleLoginChallenges.purpose, purpose), gt(googleLoginChallenges.expiresAt, new Date()));
        const [challenge] = await db.select().from(googleLoginChallenges).where(challengeFilter);
        if (!challenge || (purpose === 'link' && challenge.userId !== (req as AuthenticatedRequest).user.id)) throw invalidChallenge();
        const identity = await verifier(parsed.data.credential, nonce).catch(() => {
          throw new GoogleLoginError(401, 'GOOGLE_CREDENTIAL_INVALID', 'Não foi possível confirmar sua identidade com o Google. Tente novamente.');
        });
        const user = await db.transaction(async (tx) => {
          const consumed = await tx.delete(googleLoginChallenges).where(challengeFilter).returning();
          if (!consumed.length) throw invalidChallenge();
          if (purpose === 'link') {
            const [current] = await tx.select().from(users).where(eq(users.id, (req as AuthenticatedRequest).user.id)).for('update');
            if (!current || current.status !== 'active' || current.passwordExpired || !current.passwordHash || !('password' in parsed.data) || !(await bcrypt.compare(String(parsed.data.password), current.passwordHash))) {
              throw new GoogleLoginError(403, 'GOOGLE_LINK_PASSWORD_REQUIRED', 'Confirme sua senha atual para vincular uma conta Google.');
            }
            const [owner] = await tx.select().from(users).where(eq(users.googleSubject, identity.subject));
            if ((owner && owner.id !== current.id) || (current.googleSubject && current.googleSubject !== identity.subject)) {
              throw new GoogleLoginError(409, 'GOOGLE_ALREADY_LINKED', 'Essa vinculação não está disponível. A conta Google ou seu perfil já possui um vínculo.');
            }
            const [linked] = await tx.update(users).set({ googleSubject: identity.subject, googleEmail: identity.email, displayName: current.displayName || identity.displayName, avatarUrl: identity.avatarUrl, updatedAt: new Date() }).where(eq(users.id, current.id)).returning();
            return linked;
          }
          const isConfiguredAdmin = configuredAdminEmails().has(identity.email);
          let [existing] = await tx.select().from(users).where(eq(users.googleSubject, identity.subject));
          if (!existing) {
            // Only an explicitly configured, Google-verified email may claim its matching account.
            if (isConfiguredAdmin) {
              const [matchingEmail] = await tx.select().from(users).where(eq(users.email, identity.email)).for('update');
              if (matchingEmail?.googleSubject && matchingEmail.googleSubject !== identity.subject) {
                throw new GoogleLoginError(409, 'GOOGLE_ALREADY_LINKED', 'Essa conta Google já está vinculada a outro perfil.');
              }
              if (matchingEmail) {
                [existing] = await tx.update(users).set({
                  googleSubject: identity.subject, googleEmail: identity.email,
                  displayName: identity.displayName || matchingEmail.displayName, avatarUrl: identity.avatarUrl,
                  role: 'admin', sessionVersion: sql`${users.sessionVersion} + 1`, updatedAt: new Date(),
                }).where(eq(users.id, matchingEmail.id)).returning();
              }
            }
            if (!existing) {
              const [created] = await tx.insert(users).values({
                email: identity.email, googleSubject: identity.subject, googleEmail: identity.email,
                displayName: identity.displayName, avatarUrl: identity.avatarUrl,
                passwordHash: null, passwordExpired: false, role: isConfiguredAdmin ? 'admin' : 'user', status: 'active',
              }).onConflictDoNothing().returning();
              if (created) existing = created;
              else [existing] = await tx.select().from(users).where(eq(users.googleSubject, identity.subject));
            }
            if (!existing) throw new GoogleLoginError(409, 'GOOGLE_LINK_REQUIRED', 'Entre com sua senha e vincule esta conta ao Google antes de continuar.');
          }
          if (existing.status !== 'active') throw new GoogleLoginError(403, 'ACCOUNT_INACTIVE', 'Esta conta não está disponível para acesso.');
          const [signedIn] = await tx.update(users).set({
            lastLoginAt: new Date(), googleEmail: identity.email, displayName: identity.displayName || existing.displayName,
            avatarUrl: identity.avatarUrl,
            ...(isConfiguredAdmin && existing.email === identity.email && existing.role !== 'admin' ? { role: 'admin' as const, sessionVersion: sql`${users.sessionVersion} + 1` } : {}),
            updatedAt: new Date(),
          }).where(eq(users.id, existing.id)).returning();
          return signedIn;
        });
        void logActivity({
          userId: user.id,
          event: purpose === 'link' ? 'user.google.link' : 'user.login',
          entityType: 'user',
          entityId: user.id,
          details: { provider: 'google' },
        });
        res.setHeader('Set-Cookie', [sessionCookie(createSessionToken(user)), challengeCookie(purpose, '', true)]);
        res.json({ success: true, data: { user: publicUser(user) } });
      } catch (error) {
        res.setHeader('Set-Cookie', challengeCookie(purpose, '', true));
        if (error instanceof GoogleLoginError) return res.status(error.status).json({ success: false, code: error.code, message: error.message });
        // A concurrent account link is protected by the unique Google subject constraint.
        if (error && typeof error === 'object' && ('code' in error && error.code === '23505' || 'cause' in error && error.cause && typeof error.cause === 'object' && 'code' in error.cause && error.cause.code === '23505')) {
          return res.status(409).json({ success: false, code: 'GOOGLE_ALREADY_LINKED', message: 'Essa conta Google já está vinculada.' });
        }
        next(error);
      }
    });
  }
  return router;
}
