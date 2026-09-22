import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve } from 'node:path';
import bcrypt from 'bcryptjs';
import { eq, inArray } from 'drizzle-orm';

// Explicit opt-in: never fall back to the developer's actual application database.
const testUrl = process.env.TEST_DATABASE_URL;
if (!testUrl || !new URL(testUrl).pathname.endsWith('_test')) throw new Error('TEST_DATABASE_URL must point to a dedicated database ending in _test');
process.env.DATABASE_URL = testUrl;
process.env.JWT_SECRET = 'integration-test-only-secret-at-least-32-characters';
process.env.NODE_ENV = 'test';

test('real database: first login, authorization, revocation and active promotions', async (t) => {
  const { db, client, users, promotions } = await import('@centralpromopet/database');
  const suffix = Date.now();
  const googleAdminEmail = `google-admin-${suffix}@example.com`;
  process.env.GOOGLE_CLIENT_ID = 'integration-test-client';
  process.env.ADMIN_EMAILS = googleAdminEmail;
  const { createApp } = await import('../src/app');
  const app = createApp({ googleVerifier: async () => ({ subject: `google-subject-${suffix}`, email: googleAdminEmail, displayName: 'Google Admin', avatarUrl: null }) });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const base = `http://127.0.0.1:${address.port}`;
  const email = `admin-${suffix}@example.com`;
  const initial = 'Temporary-password-123!';
  const updated = 'Updated-password-456!';
  const userIds: string[] = [];
  const createdUserIds: string[] = [];
  const offerIds: string[] = [];
  let cookie = '';
  const request = (path: string, body?: unknown, session = cookie, extra: Record<string, string> = {}) => fetch(`${base}${path}`, { method: body === undefined ? 'GET' : 'POST', headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(session ? { Cookie: session } : {}), ...extra }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  try {
    await t.test('one-time bootstrap creates a hashed temporary admin and refuses a second run', async () => {
      const bootstrapEmail = `bootstrap-${suffix}@example.com`;
      const run = () => promisify(execFile)(process.execPath, [resolve(__dirname, '../dist/scripts/bootstrapAdmin.js')], {
        env: { ...process.env, BOOTSTRAP_ADMIN_EMAIL: bootstrapEmail, BOOTSTRAP_ADMIN_PASSWORD: initial },
      });
      await run();
      const [admin] = await db.select().from(users).where(eq(users.email, bootstrapEmail));
      userIds.push(admin.id);
      assert.equal(admin.role, 'admin'); assert.equal(admin.passwordExpired, true);
      assert.ok(await bcrypt.compare(initial, admin.passwordHash));
      await assert.rejects(run, /An administrator already exists/);
    });
    const hash = await bcrypt.hash(initial, 12);
    const inserted = await db.insert(users).values([
      { email, passwordHash: hash, role: 'admin', passwordExpired: true },
      { email: `user-${suffix}@example.com`, passwordHash: hash, role: 'user', passwordExpired: false },
    ]).returning();
    userIds.push(...inserted.map((user) => user.id));
    await t.test('private routes reject anonymous requests', async () => {
      assert.equal((await request('/api/admin/status')).status, 401);
      assert.equal((await request('/api/account')).status, 401);
      assert.equal((await request('/api/promotions/admin')).status, 401);
      assert.equal((await request('/api/promotions', { title: 'Offer' })).status, 401);
      assert.equal((await request('/api/admin/users')).status, 401);
      assert.equal((await request('/ready')).status, 200);
    });
    await t.test('rejects cross-origin and non-JSON mutations', async () => {
      assert.equal((await request('/api/identity/login', { email, password: initial }, '', { Origin: 'https://evil.example' })).status, 403);
      const response = await fetch(`${base}/api/identity/login`, { method: 'POST', body: 'email=foo', headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
      assert.equal(response.status, 415);
    });
    await t.test('login issues cookie, hides token/hash, requires password replacement', async () => {
      assert.equal((await request('/api/identity/login', { email, password: 'wrong' })).status, 401);
      const response = await request('/api/identity/login', { email: email.toUpperCase(), password: initial });
      assert.equal(response.status, 200);
      const body = await response.json();
      assert.equal(body.data.user.passwordExpired, true);
      assert.equal(body.data.token, undefined); assert.equal(body.data.user.passwordHash, undefined);
      cookie = response.headers.get('set-cookie')!.split(';')[0];
      const denied = await request('/api/admin/status');
      assert.equal(denied.status, 403); assert.equal((await denied.json()).code, 'PASSWORD_EXPIRED');
      assert.equal((await request('/api/promotions/admin')).status, 403);
      assert.equal((await request('/api/promotions', { title: 'Offer' })).status, 403);
      assert.equal((await request('/api/account')).status, 403);
      assert.equal((await request('/api/identity/me')).status, 200);
    });
    await t.test('only the explicitly configured verified Google email receives admin access', async () => {
      const challenge = await request('/api/identity/google/challenge', {});
      assert.equal(challenge.status, 200);
      const nonce = (await challenge.json()).data.nonce;
      const challengeCookie = challenge.headers.get('set-cookie')!.split(';')[0];
      const response = await request('/api/identity/google/', { credential: 'mock-google-credential' }, '', { Cookie: challengeCookie });
      assert.equal(response.status, 200);
      const data = (await response.json()).data;
      assert.equal(data.user.email, googleAdminEmail);
      assert.equal(data.user.role, 'admin');
      assert.equal(data.user.passwordExpired, false);
      assert.ok(nonce);
      userIds.push(data.user.id);
    });
    await t.test('password change validates old/new passwords and invalidates old sessions', async () => {
      assert.equal((await request('/api/identity/change-password', { oldPassword: 'incorrect', newPassword: updated })).status, 400);
      assert.equal((await request('/api/identity/change-password', { oldPassword: initial, newPassword: initial })).status, 400);
      assert.equal((await request('/api/identity/change-password', { oldPassword: initial, newPassword: 'short' })).status, 400);
      const oldCookie = cookie;
      const response = await request('/api/identity/change-password', { oldPassword: initial, newPassword: updated });
      assert.equal(response.status, 200);
      cookie = response.headers.get('set-cookie')!.split(';')[0];
      assert.equal((await request('/api/admin/status', undefined, oldCookie)).status, 401);
      assert.equal((await request('/api/admin/status')).status, 200);
      assert.equal((await request('/api/identity/login', { email, password: initial })).status, 401);
      const [user] = await db.select().from(users).where(eq(users.email, email));
      assert.equal(user.passwordExpired, false); assert.ok(await bcrypt.compare(updated, user.passwordHash));
    });
    await t.test('client role and deactivated accounts cannot access admin', async () => {
      const response = await request('/api/identity/login', { email: inserted[1].email, password: initial }, '');
      const clientCookie = response.headers.get('set-cookie')!.split(';')[0];
      assert.equal((await request('/api/account', undefined, clientCookie)).status, 200);
      assert.equal((await request('/api/admin/status', undefined, clientCookie)).status, 403);
      assert.equal((await request('/api/promotions/admin', undefined, clientCookie)).status, 403);
      assert.equal((await request('/api/promotions', { title: 'Offer' }, clientCookie)).status, 403);
      assert.equal((await request('/api/admin/users', undefined, clientCookie)).status, 403);
      assert.equal((await request('/api/admin/users', { email: 'new@example.com' }, clientCookie)).status, 403);
      await db.update(users).set({ status: 'inactive' }).where(eq(users.id, inserted[1].id));
      assert.equal((await request('/api/identity/me', undefined, clientCookie)).status, 401);
    });
    await t.test('admins can register and list pet-specific promotions', async () => {
      const valid = {
        title: 'Coleira Plaquinha Nome Telefone Gato Cachorro Identificação Aço Inox',
        store: 'Mercado Livre', currency: 'BRL', coupon: 'BATEUPRONTOCUPOM', storeVerified: true,
        petTypes: ['dogs', 'cats'], originalPrice: '38.90', promotionalPrice: '27.22',
        affiliateUrl: 'https://meli.la/2Je3kJq', endsAt: new Date(Date.now() + 86400000).toISOString(), status: 'published',
      };
      assert.equal((await request('/api/promotions', { ...valid, petTypes: [] })).status, 400);
      const response = await request('/api/promotions', valid);
      assert.equal(response.status, 201);
      const body = await response.json();
      offerIds.push(body.data.id);
      assert.equal(body.data.priceCents, 2722);
      assert.equal(body.data.originalPriceCents, 3890);
      assert.equal(body.data.currency, 'BRL');
      assert.deepEqual(body.data.petTypes, ['dogs', 'cats']);
      assert.equal(body.data.coupon, 'BATEUPRONTOCUPOM');
      assert.equal(body.data.storeVerified, true);
      const listed = await request('/api/promotions/admin');
      assert.equal(listed.status, 200);
      assert.ok((await listed.json()).data.some((offer: { id: string }) => offer.id === body.data.id));

      const noReferencePrice = await request('/api/promotions', {
        ...valid, title: 'Oferta sem preço original', originalPrice: '', coupon: '', petTypes: ['cats'], status: 'draft',
      });
      assert.equal(noReferencePrice.status, 201);
      const draft = await noReferencePrice.json();
      offerIds.push(draft.data.id);
      assert.equal(draft.data.originalPriceCents, null);
      assert.equal(draft.data.coupon, null);
      assert.equal(draft.data.status, 'draft');
    });
    await t.test('admins can create users with a mandatory temporary password change', async () => {
      const body = { email: `new-user-${suffix}@example.com`, displayName: 'Pessoa de Teste', temporaryPassword: initial, role: 'user' };
      assert.equal((await request('/api/admin/users', { ...body, temporaryPassword: 'short' })).status, 400);
      const response = await request('/api/admin/users', body);
      assert.equal(response.status, 201);
      const created = (await response.json()).data;
      createdUserIds.push(created.id);
      assert.equal(created.email, body.email);
      assert.equal(created.displayName, body.displayName);
      assert.equal(created.role, 'user');
      assert.equal(created.passwordExpired, true);
      assert.equal(created.passwordHash, undefined);
      const [stored] = await db.select().from(users).where(eq(users.id, created.id));
      assert.ok(await bcrypt.compare(initial, stored.passwordHash));
      assert.equal((await request('/api/admin/users', body)).status, 409);
      const listed = await request('/api/admin/users');
      assert.ok((await listed.json()).data.some((user: { id: string }) => user.id === created.id));
    });
    await t.test('public offers exclude drafts, future and expired promotions', async () => {
      const now = Date.now();
      const common = { title: `test-${suffix}`, store: 'Test store', priceCents: 1990, affiliateUrl: 'https://example.com', startsAt: new Date(now - 60000), endsAt: new Date(now + 60000) };
      const rows = await db.insert(promotions).values([
        { ...common, status: 'published' },
        { ...common, status: 'draft' },
        { ...common, status: 'published', startsAt: new Date(now + 30000) },
        { ...common, status: 'published', endsAt: new Date(now - 1000) },
      ]).returning();
      offerIds.push(...rows.map((offer) => offer.id));
      const response = await request('/api/promotions/today', undefined, '');
      assert.equal(response.status, 200);
      const body = await response.json();
      const caseIds = rows.map((offer) => offer.id);
      const matches = body.data.filter((offer: { id: string }) => caseIds.includes(offer.id));
      assert.deepEqual(matches.map((offer: { id: string }) => offer.id), [rows[0].id]);
      assert.equal(body.meta.timeZone, 'America/Sao_Paulo'); assert.equal(matches[0].priceCents, 1990);
    });
    await t.test('logout expires cookie', async () => {
      const response = await request('/api/identity/logout', {});
      assert.equal(response.status, 200); assert.match(response.headers.get('set-cookie')!, /Max-Age=0/);
    });
  } finally {
    if (offerIds.length) await db.delete(promotions).where(inArray(promotions.id, offerIds));
    if (createdUserIds.length) await db.delete(users).where(inArray(users.id, createdUserIds));
    if (userIds.length) await db.delete(users).where(inArray(users.id, userIds));
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await client.end();
  }
});
