import { NextFunction, Request, Response } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { eq } from 'drizzle-orm';
import { db, users } from '@centralpromopet/database';

export type UserRole = 'admin' | 'user';
export type AuthUser = { id: string; email: string; role: UserRole; passwordExpired: boolean; displayName?: string | null; avatarUrl?: string | null; hasPassword?: boolean; googleLinked?: boolean; googleEmail?: string | null; sessionVersion?: number };
export type AuthenticatedRequest = Request & { user: AuthUser };

const cookieName = 'centralpromopet_session';

export function validateJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) throw new Error('JWT_SECRET must contain at least 32 characters');
  return secret;
}

export function createSessionToken(user: AuthUser) {
  return jwt.sign({ email: user.email, role: user.role, version: user.sessionVersion ?? 0 }, validateJwtSecret(), {
    subject: user.id,
    expiresIn: '8h',
    issuer: 'centralpromopet-api',
    audience: 'centralpromopet-web',
  });
}

export function sessionCookie(token: string) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${cookieName}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=28800${secure}`;
}

export function clearSessionCookie() {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${cookieName}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure}`;
}

function tokenFromRequest(req: Request) {
  const bearer = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
  if (bearer) return bearer;
  return req.headers.cookie
    ?.split(';')
    .map((part) => part.trim().split('='))
    .find(([name]) => name === cookieName)?.[1];
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const token = tokenFromRequest(req);
    if (!token) return res.status(401).json({ success: false, message: 'Authentication required' });
    const payload = jwt.verify(token, validateJwtSecret(), {
      issuer: 'centralpromopet-api',
      audience: 'centralpromopet-web',
      algorithms: ['HS256'],
    }) as JwtPayload;
    if (!payload.sub) throw new Error('Invalid session');
    const [user] = await db.select().from(users).where(eq(users.id, payload.sub));
    if (!user || user.status !== 'active' || payload.version !== user.sessionVersion) throw new Error('Invalid session');
    (req as AuthenticatedRequest).user = publicUser(user);
    next();
  } catch {
    res.setHeader('Set-Cookie', clearSessionCookie());
    return res.status(401).json({ success: false, message: 'Invalid or expired session' });
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const user = (req as AuthenticatedRequest).user;
  if (user.role !== 'admin') return res.status(403).json({ success: false, message: 'Administrator access required' });
  next();
}

export function requireCurrentPassword(req: Request, res: Response, next: NextFunction) {
  const user = (req as AuthenticatedRequest).user;
  if (user.passwordExpired) return res.status(403).json({ success: false, message: 'Password change required', code: 'PASSWORD_EXPIRED' });
  next();
}

export function publicUser(user: typeof users.$inferSelect): AuthUser {
  return {
    id: user.id, email: user.email, role: user.role, passwordExpired: user.passwordExpired,
    displayName: user.displayName, avatarUrl: user.avatarUrl,
    hasPassword: Boolean(user.passwordHash), googleLinked: Boolean(user.googleSubject), googleEmail: user.googleEmail,
  };
}
