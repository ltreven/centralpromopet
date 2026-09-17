import { test } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { createSessionToken, sessionCookie, clearSessionCookie, validateJwtSecret } from '../src/auth';

test('session JWT has isolated audience, issuer, lifetime and revocation version', () => {
  process.env.JWT_SECRET = 'test-only-secret-with-at-least-32-characters';
  const token = createSessionToken({ id: 'test-user', email: 'test@example.com', role: 'admin', passwordExpired: true, sessionVersion: 2 });
  const payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'], issuer: 'centralpromopet-api', audience: 'centralpromopet-web' }) as jwt.JwtPayload;
  assert.equal(payload.sub, 'test-user');
  assert.equal(payload.version, 2);
  assert.equal(payload.exp! - payload.iat!, 8 * 60 * 60);
  assert.throws(() => jwt.verify(token, process.env.JWT_SECRET!, { audience: 'agrisense-web' }));
});
test('production cookies are HttpOnly, Secure and SameSite, including logout', () => {
  const original = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  try {
    assert.match(sessionCookie('token'), /^centralpromopet_session=token;/);
    for (const cookie of [sessionCookie('token'), clearSessionCookie()]) {
      assert.match(cookie, /; HttpOnly;/); assert.match(cookie, /; SameSite=Lax;/); assert.match(cookie, /; Secure$/);
    }
    assert.match(clearSessionCookie(), /Max-Age=0/);
  } finally { if (original === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = original; }
});
test('refuses missing or weak JWT secrets', () => {
  const original = process.env.JWT_SECRET;
  try {
    delete process.env.JWT_SECRET; assert.throws(validateJwtSecret);
    process.env.JWT_SECRET = 'short'; assert.throws(validateJwtSecret);
  } finally { process.env.JWT_SECRET = original; }
});
