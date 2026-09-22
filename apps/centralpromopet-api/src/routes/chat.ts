import { Router } from 'express';
import { z } from 'zod';
import { and, desc, eq, inArray, gt, lte } from 'drizzle-orm';
import { db, aiMemories, aiActions, chatThreads, chatMessages, pets, promotions } from '@centralpromopet/database';
import { AuthenticatedRequest, requireAuth, requireCurrentPassword } from '../auth';
import { AiError, getConfig } from '../ai/config';
import { createModel, ModelCall } from '../ai/provider';
import { buildGraph, loadContext, searchOffers } from '../ai/graph';
import { checkpointer, consumeQuota, withUserLock, ownedThread, eraseThread, eraseAll, eraseConversationContext } from '../ai/storage';
import { actionLabel, decideAction } from '../ai/actions';
import { actionSchema } from '../ai/contracts';
import { logActivity } from '../activity';

export function createChatRouter(modelOverride?: ModelCall) {
  const router = Router();
  router.use(requireAuth, requireCurrentPassword);
  router.use((_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
  const uid = (req: unknown) => (req as AuthenticatedRequest).user.id;
  router.get('/threads', async (req, res, next) => {
    try { res.json({ data: await db.select().from(chatThreads).where(eq(chatThreads.userId, uid(req))).orderBy(desc(chatThreads.updatedAt)).limit(100) }); } catch (e) { next(e); }
  });
  router.get('/threads/:id', async (req, res, next) => {
    try {
      const id = z.string().uuid().parse(req.params.id);
      await ownedThread(uid(req), id);
      const rows = await db.select().from(chatMessages).where(eq(chatMessages.threadId, id)).orderBy(desc(chatMessages.createdAt), desc(chatMessages.id)).limit(100);
      const actions = await db.select().from(aiActions).where(and(eq(aiActions.threadId, id), eq(aiActions.userId, uid(req)), eq(aiActions.status, 'pending'), gt(aiActions.createdAt, new Date(Date.now() - 86400000))));
      const ids = [...new Set(rows.flatMap((row) => row.promotionIds))];
      const offers = ids.length ? await db.select().from(promotions).where(and(inArray(promotions.id, ids), eq(promotions.status, 'published'), lte(promotions.startsAt, new Date()), gt(promotions.endsAt, new Date()))) : [];
      res.json({ data: { messages: rows.reverse(), actions: actions.map(({ id, label }) => ({ id, label })), offers } });
    } catch (e) { next(e); }
  });
  router.post('/messages', async (req, res, next) => {
    try {
      const { threadId, message } = z.object({ threadId: z.string().uuid().optional(), message: z.string().trim().min(1).max(2000) }).strict().parse(req.body);
      const result = await withUserLock(uid(req), async () => {
        const config = await getConfig();
        if (!config.enabled) throw new AiError('O assistente está sendo preparado. Volte em breve!', 503);
        if (threadId) await ownedThread(uid(req), threadId);
        await consumeQuota(uid(req), config.dailyMessageLimit);
        const thread = threadId ? await ownedThread(uid(req), threadId) : (await db.insert(chatThreads).values({ userId: uid(req), title: message.slice(0, 100) }).returning())[0];
        const graph = buildGraph({ model: modelOverride || createModel(config), context: () => loadContext(uid(req), thread.id, message), search: (query) => searchOffers(config, query), saver: checkpointer() });
        const output = await graph.invoke({ message, response: { answer: '', summary: '', promotionIds: [] } }, { configurable: { thread_id: thread.id }, recursionLimit: 8 });
        const remembered: string[] = [];
        await db.transaction(async (tx) => {
          for (const action of output.plan.actions) {
            const petId = action.kind === 'remember' ? action.memory.petId : 'petId' in action ? action.petId : null;
            const name = output.context.pets.find((pet) => pet.id === petId)?.name || '';
            if (action.kind === 'remember' && action.memory.category !== 'health') {
              const [duplicate] = await tx.select().from(aiMemories).where(and(eq(aiMemories.userId, uid(req)), eq(aiMemories.petId, action.memory.petId), eq(aiMemories.content, action.memory.content)));
              if (!duplicate) { await tx.insert(aiMemories).values({ userId: uid(req), ...action.memory }); remembered.push(action.memory.content); }
            } else {
              // Replace a previous proposal for this same pet, so stale buttons cannot execute later.
              for (const pending of output.context.pendingActions || []) {
                const previous = actionSchema.safeParse(pending.payload);
                if (!previous.success) continue;
                const samePet = action.kind === 'create_pet' && previous.data.kind === 'create_pet'
                  ? action.fields.name.toLocaleLowerCase('pt-BR') === previous.data.fields.name.toLocaleLowerCase('pt-BR')
                  : action.kind === 'update_pet' && previous.data.kind === 'update_pet' && action.petId === previous.data.petId;
                if (samePet) await tx.update(aiActions).set({ status: 'cancelled' }).where(and(eq(aiActions.id, pending.id), eq(aiActions.userId, uid(req)), eq(aiActions.status, 'pending')));
              }
              const label = actionLabel(action, name);
              await tx.insert(aiActions).values({ userId: uid(req), threadId: thread.id, payload: action, label });
            }
          }
          const now = Date.now();
          await tx.insert(chatMessages).values([
            { threadId: thread.id, role: 'user', content: message, createdAt: new Date(now) },
            { threadId: thread.id, role: 'assistant', content: output.response.answer, promotionIds: output.response.promotionIds, createdAt: new Date(now + 1) },
          ]);
          await tx.update(chatThreads).set({ summary: output.response.summary, updatedAt: new Date(now + 1) }).where(eq(chatThreads.id, thread.id));
        });
        const pending = await db.select({ id: aiActions.id, label: aiActions.label }).from(aiActions).where(and(eq(aiActions.userId, uid(req)), eq(aiActions.threadId, thread.id), eq(aiActions.status, 'pending'), gt(aiActions.createdAt, new Date(Date.now() - 86400000))));
        return { threadId: thread.id, answer: output.response.answer, actions: pending, remembered, offers: output.offers.filter((offer) => output.response.promotionIds.includes(offer.id)) };
      });
      void logActivity({ userId: uid(req), event: 'chat.message', entityType: 'chat_thread', entityId: result.threadId, details: { actions: result.actions.length, remembered: result.remembered.length } });
      res.json({ data: result });
    } catch (e) { next(e); }
  });
  router.post('/actions/:id', async (req, res, next) => {
    try {
      const id = z.string().uuid().parse(req.params.id);
      const { approved } = z.object({ approved: z.boolean() }).strict().parse(req.body);
      const data = await withUserLock(uid(req), () => decideAction(uid(req), id, approved));
      void logActivity({ userId: uid(req), event: approved ? 'chat.action.approve' : 'chat.action.reject', entityType: 'ai_action', entityId: id, details: { kind: data.actionKind } });
      res.json({ data });
    } catch (e) { next(e); }
  });
  router.get('/memory', async (req, res, next) => {
    try {
      const [memories, petRows, threads] = await Promise.all([
        db.select().from(aiMemories).where(eq(aiMemories.userId, uid(req))).orderBy(desc(aiMemories.createdAt)),
        db.select().from(pets).where(eq(pets.userId, uid(req))),
        db.select().from(chatThreads).where(eq(chatThreads.userId, uid(req))).orderBy(desc(chatThreads.updatedAt)).limit(100),
      ]);
      res.json({ data: { memories, pets: petRows, threads } });
    } catch (e) { next(e); }
  });
  router.delete('/memory/:id', async (req, res, next) => {
    try {
      const id = z.string().uuid().parse(req.params.id);
      await withUserLock(uid(req), async () => {
        const [memory] = await db.select().from(aiMemories).where(and(eq(aiMemories.id, id), eq(aiMemories.userId, uid(req))));
        if (!memory) throw new AiError('Memória não encontrada.', 404);
        await eraseConversationContext(uid(req));
        await db.delete(aiMemories).where(and(eq(aiMemories.id, id), eq(aiMemories.userId, uid(req))));
      });
      res.json({ success: true });
    } catch (e) { next(e); }
  });
  router.delete('/threads/:id', async (req, res, next) => {
    try { const id = z.string().uuid().parse(req.params.id); await withUserLock(uid(req), () => eraseThread(uid(req), id)); res.json({ success: true }); } catch (e) { next(e); }
  });
  router.delete('/memory', async (req, res, next) => {
    try { await withUserLock(uid(req), () => eraseAll(uid(req))); res.json({ success: true }); } catch (e) { next(e); }
  });
  return router;
}
