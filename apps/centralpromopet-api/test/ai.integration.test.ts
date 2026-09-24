import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { and, eq, inArray } from 'drizzle-orm';

const url = process.env.TEST_DATABASE_URL;
if (!url || !new URL(url).pathname.endsWith('_test')) throw new Error('Use a dedicated TEST_DATABASE_URL ending in _test');
process.env.DATABASE_URL = url;
process.env.JWT_SECRET = 'ai-test-only-secret-at-least-thirty-two-characters';
process.env.NODE_ENV = 'test';

test('AI: authorization, durable graph, RAG, confirmation, ownership and erasure', async (t) => {
  const { db, client, users, pets, promotions, aiSettings, chatThreads, chatMessages, aiMemories, aiActions } = await import('@centralpromopet/database');
  const { createApp } = await import('../src/app');
  const { createSessionToken } = await import('../src/auth');
  const { closeCheckpointer, withUserLock } = await import('../src/ai/storage');
  const { settingsSchema } = await import('../src/ai/config');
  const { searchOffers } = await import('../src/ai/graph');
  const suffix = randomUUID();
  const accounts = await db.insert(users).values([
    { email: `ai-admin-${suffix}@example.com`, passwordHash: 'test', role: 'admin', passwordExpired: false },
    { email: `ai-user-${suffix}@example.com`, passwordHash: 'test', passwordExpired: false },
    { email: `ai-other-${suffix}@example.com`, passwordHash: 'test', passwordExpired: false },
    { email: `ai-expired-${suffix}@example.com`, passwordHash: 'test', passwordExpired: true },
  ]).returning();
  const [pet, otherPet] = await db.insert(pets).values([{ userId: accounts[1].id, name: 'Thor', type: 'dogs' }, { userId: accounts[2].id, name: 'Luna', type: 'cats' }]).returning();
  const now = Date.now();
  const clothingTitle = `Roupa Protetora ${randomUUID()}`;
  const offers = await db.insert(promotions).values([
    { title: `Brinquedo ${suffix}`, store: 'Test', priceCents: 1000, affiliateUrl: 'https://example.com/offer', startsAt: new Date(now - 86400000), endsAt: new Date(now + 86400000), status: 'published' },
    { title: clothingTitle, store: 'Test', priceCents: 1000, affiliateUrl: 'https://example.com/clothing', startsAt: new Date(now - 86400000), endsAt: new Date(now + 86400000), status: 'published' },
    { title: `Brinquedo ${suffix}`, store: 'Test', priceCents: 1000, affiliateUrl: 'https://example.com/expired', startsAt: new Date(now - 86400000), endsAt: new Date(now - 1000), status: 'published' },
    { title: `Brinquedo ${suffix}`, store: 'Test', priceCents: 1000, affiliateUrl: 'https://example.com/old', startsAt: new Date(now - 86400000), endsAt: new Date(now + 86400000), createdAt: new Date(now - 70 * 86400000), status: 'published' },
    { title: `Brinquedo ${suffix}`, store: 'Test', priceCents: 1000, affiliateUrl: 'https://example.com/draft', startsAt: new Date(now - 86400000), endsAt: new Date(now + 86400000), status: 'draft' },
  ]).returning();
  const [previousSettings] = await db.select().from(aiSettings).where(eq(aiSettings.id, 1));
  const config = settingsSchema.parse({ enabled: true, dailyMessageLimit: 40 });
  let observedContext: { pets: { id: string; type: string }[]; recent: unknown[]; summary: string } | undefined;
  const app = createApp({ aiModel: async (instructions, input) => {
    const state = input as { message: string; context: typeof observedContext; offers?: { id: string }[] };
    observedContext = state.context;
    if (instructions.includes('Interprete a mensagem atual')) {
      const actions = state.message === 'mude Thor para gato' ? [{ kind: 'update_pet', petId: pet.id, fields: { type: 'cats' }, sourceQuote: state.message }]
        : state.message === 'exclua Thor' ? [{ kind: 'delete_pet', petId: pet.id, sourceQuote: state.message }]
        : state.message === 'sim, quero novidades' ? [{ kind: 'subscribe_newsletter', sourceQuote: state.message }]
        : state.message === 'Thor gosta de bola' ? [{ kind: 'remember', memory: { petId: pet.id, content: 'Gosta de bola', category: 'preference', sourceQuote: state.message } }]
        : state.message === 'Thor tem alergia a frango' ? [{ kind: 'remember', memory: { petId: pet.id, content: 'Alergia a frango relatada', category: 'health', sourceQuote: state.message } }]
        : state.message === 'invadir' ? [{ kind: 'delete_pet', petId: otherPet.id, sourceQuote: state.message }]
        : state.message === 'cadastrar Max cachorro' ? [{ kind: 'create_pet', fields: { name: 'Max', type: 'dogs' }, sourceQuote: state.message }]
        : [];
      return { search: state.message.startsWith('ofertas') ? { query: suffix } : null, actions };
    }
    return { answer: 'Resposta de teste útil para seu pet.', summary: 'Resumo persistente de teste.', promotionIds: [...(state.offers || []).map((o) => o.id), randomUUID()] };
  } });
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  const address = server.address(); assert.ok(address && typeof address === 'object');
  const request = async (path: string, method = 'GET', body?: unknown, account = 1) => {
    const response = await fetch(`http://127.0.0.1:${address.port}/api/${path}`, { method, headers: { ...(account >= 0 ? { Cookie: `centralpromopet_session=${createSessionToken(accounts[account])}` } : {}), ...(method !== 'GET' ? { 'Content-Type': 'application/json' } : {}) }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
    return { status: response.status, body: await response.json() };
  };
  let thread = '';
  try {
    await t.test('private chat and settings enforce both authentication and admin role', async () => {
      assert.equal((await request('chat/threads', 'GET', undefined, -1)).status, 401);
      assert.equal((await request('chat/messages', 'POST', { message: 'oi' }, 3)).status, 403);
      assert.equal((await request('admin/ai-settings')).status, 403);
      const result = await request('admin/ai-settings', 'GET', undefined, 0);
      assert.equal(result.status, 200); assert.equal(result.body.data.config.apiKey, undefined);
      assert.equal((await request('admin/ai-settings', 'PUT', { ...config, enabled: false, promotionsDays: -1 }, 0)).status, 400);
      assert.equal((await request('admin/ai-settings', 'PUT', { ...config, enabled: false }, 0)).status, 200);
      assert.equal((await request('chat/messages', 'POST', { message: 'oi' })).status, 503);
      await db.update(aiSettings).set({ config }).where(eq(aiSettings.id, 1));
    });
    await t.test('real LangGraph persists conversation and only emits valid current offers', async () => {
      const result = await request('chat/messages', 'POST', { message: 'ofertas para cães' });
      assert.equal(result.status, 200, JSON.stringify(result.body));
      thread = result.body.data.threadId;
      assert.deepEqual(result.body.data.offers.map((o: { id: string }) => o.id), [offers[0].id]);
      assert.deepEqual(observedContext?.pets.map((p) => p.id), [pet.id]);
      const [checkpoint] = await client`select count(*)::int as count from ai_checkpoints.checkpoints where thread_id = ${thread}`;
      assert.ok(checkpoint.count > 0);
      await closeCheckpointer();
      const next = await request('chat/messages', 'POST', { threadId: thread, message: 'continue' });
      assert.equal(next.status, 200, JSON.stringify(next.body));
      assert.equal(observedContext?.recent.length, 2); assert.match(observedContext?.summary || '', /persistente/);
      const wide = await searchOffers({ ...config, promotionsDays: 90 }, { query: suffix });
      assert.equal(wide.length, 2);
      assert.equal((await searchOffers(config, { query: suffix })).length, 1);
      const clothing = await searchOffers(config, { query: 'roupinhas pra cachorro' });
      assert.ok(clothing.some((offer) => offer.title === clothingTitle));
    });
    await t.test('another user cannot read, mutate or erase the conversation', async () => {
      assert.equal((await request(`chat/threads/${thread}`, 'GET', undefined, 2)).status, 404);
      assert.equal((await request('chat/messages', 'POST', { threadId: thread, message: 'oi' }, 2)).status, 404);
      assert.equal((await request(`chat/threads/${thread}`, 'DELETE', {}, 2)).status, 404);
      const attempt = await request('chat/messages', 'POST', { threadId: thread, message: 'invadir' });
      assert.deepEqual(attempt.body.data.actions, []);
    });
    await t.test('pet correction is confirmed, idempotent and in the next turn context', async () => {
      const result = await request('chat/messages', 'POST', { threadId: thread, message: 'mude Thor para gato' });
      const id = result.body.data.actions[0].id;
      assert.equal((await request(`chat/actions/${id}`, 'POST', { approved: true }, 2)).status, 404);
      assert.equal((await db.select().from(pets).where(eq(pets.id, pet.id)))[0].type, 'dogs');
      assert.equal((await request(`chat/actions/${id}`, 'POST', { approved: true })).status, 200);
      assert.equal((await request(`chat/actions/${id}`, 'POST', { approved: true })).body.data.status, 'confirmed');
      await request('chat/messages', 'POST', { threadId: thread, message: 'continue' });
      assert.equal(observedContext?.pets[0].type, 'cats');
    });
    await t.test('new pet and newsletter are separate, explicit actions', async () => {
      const creation = await request('chat/messages', 'POST', { threadId: thread, message: 'cadastrar Max cachorro' });
      const id = creation.body.data.actions[0].id;
      await request(`chat/actions/${id}`, 'POST', { approved: true });
      await request(`chat/actions/${id}`, 'POST', { approved: true });
      assert.equal((await db.select().from(pets).where(and(eq(pets.userId, accounts[1].id), eq(pets.name, 'Max')))).length, 1);
      assert.equal((await db.select().from(users).where(eq(users.id, accounts[1].id)))[0].receiveNewsletter, false);
      const subscribe = await request('chat/messages', 'POST', { threadId: thread, message: 'sim, quero novidades' });
      await request(`chat/actions/${subscribe.body.data.actions[0].id}`, 'POST', { approved: true });
      assert.equal((await db.select().from(users).where(eq(users.id, accounts[1].id)))[0].receiveNewsletter, true);
    });
    await t.test('preferences are stored, health memory requires confirmation, erasure removes old context', async () => {
      await request('chat/messages', 'POST', { threadId: thread, message: 'Thor gosta de bola' });
      const health = await request('chat/messages', 'POST', { threadId: thread, message: 'Thor tem alergia a frango' });
      assert.equal((await db.select().from(aiMemories).where(eq(aiMemories.userId, accounts[1].id))).length, 1);
      await request(`chat/actions/${health.body.data.actions[0].id}`, 'POST', { approved: true });
      const memories = await db.select().from(aiMemories).where(eq(aiMemories.userId, accounts[1].id));
      assert.equal(memories.length, 2);
      assert.equal((await request(`chat/memory/${memories[0].id}`, 'DELETE', {}, 2)).status, 404);
      assert.equal((await request(`chat/memory/${memories[0].id}`, 'DELETE', {})).status, 200);
      assert.equal((await db.select().from(chatMessages).where(eq(chatMessages.threadId, thread))).length, 0);
      const [checkpoint] = await client`select count(*)::int as count from ai_checkpoints.checkpoints where thread_id = ${thread}`;
      assert.equal(checkpoint.count, 0);
      assert.equal((await db.select().from(chatThreads).where(eq(chatThreads.id, thread)))[0].summary, '');
    });
    await t.test('deletion cancellation preserves pet; confirmation erases pet and its memory', async () => {
      const proposal = await request('chat/messages', 'POST', { threadId: thread, message: 'exclua Thor' });
      await request(`chat/actions/${proposal.body.data.actions[0].id}`, 'POST', { approved: false });
      assert.equal((await db.select().from(pets).where(eq(pets.id, pet.id))).length, 1);
      const retry = await request('chat/messages', 'POST', { threadId: thread, message: 'exclua Thor' });
      assert.equal((await request(`chat/actions/${retry.body.data.actions[0].id}`, 'POST', { approved: true })).status, 200);
      assert.equal((await db.select().from(pets).where(eq(pets.id, pet.id))).length, 0);
      assert.equal((await db.select().from(aiMemories).where(eq(aiMemories.petId, pet.id))).length, 0);
      assert.equal((await db.select().from(pets).where(eq(pets.id, otherPet.id))).length, 1);
    });
    await t.test('per-user locking and durable quota prevent concurrent work / excess calls', async () => {
      await withUserLock(accounts[1].id, async () => {
        assert.equal((await request('chat/messages', 'POST', { message: 'oi' })).status, 409);
      });
      await db.update(aiSettings).set({ config: { ...config, dailyMessageLimit: 1 } }).where(eq(aiSettings.id, 1));
      assert.equal((await request('chat/messages', 'POST', { message: 'oi' })).status, 429);
      assert.equal((await request('chat/memory', 'DELETE', {})).status, 200);
      assert.equal((await db.select().from(chatThreads).where(eq(chatThreads.userId, accounts[1].id))).length, 0);
    });
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await closeCheckpointer();
    if (previousSettings) await db.update(aiSettings).set({ config: previousSettings.config, updatedBy: previousSettings.updatedBy }).where(eq(aiSettings.id, 1));
    else await db.delete(aiSettings).where(eq(aiSettings.id, 1));
    await db.delete(promotions).where(inArray(promotions.id, offers.map((o) => o.id)));
    await db.delete(users).where(inArray(users.id, accounts.map((u) => u.id)));
    await client.end();
  }
});
