import { Annotation, StateGraph, START, END } from '@langchain/langgraph';
import type { BaseCheckpointSaver } from '@langchain/langgraph-checkpoint';
import { and, desc, eq, ne, gte, lte, gt, ilike, or, sql } from 'drizzle-orm';
import { db, users, pets, aiMemories, aiActions, chatMessages, promotions, chatThreads } from '@centralpromopet/database';
import { AiConfig, AiError } from './config';
import { ModelCall } from './provider';
import { planSchema, actionSchema, answerSchema, parsePlanResponse, PLAN, SYSTEM, explicitQuote, validateBirth } from './contracts';

export type Offer = Pick<typeof promotions.$inferSelect, 'id' | 'title' | 'store' | 'priceCents' | 'originalPriceCents' | 'currency' | 'coupon' | 'affiliateUrl' | 'endsAt'>;
export type Context = { pets: (typeof pets.$inferSelect)[]; memories: (typeof aiMemories.$inferSelect)[]; summary: string; previousSummaries: string[]; recent: { role: string; content: string }[]; newsletterSubscribed: boolean; pendingActions?: { id: string; payload: Record<string, unknown> }[] };
export const State = Annotation.Root({
  message: Annotation<string>(), context: Annotation<Context>(),
  plan: Annotation<ReturnType<typeof planSchema.parse>>(), offers: Annotation<Offer[]>(),
  response: Annotation<ReturnType<typeof answerSchema.parse>>(),
});
export async function loadContext(userId: string, threadId: string, message = ''): Promise<Context> {
  const [petRows, memoryRows, messages, threads, profiles, previousThreads, pendingActions] = await Promise.all([
    db.select().from(pets).where(eq(pets.userId, userId)),
    db.select().from(aiMemories).where(eq(aiMemories.userId, userId)).orderBy(desc(aiMemories.createdAt)).limit(100),
    db.select({ role: chatMessages.role, content: chatMessages.content }).from(chatMessages).where(eq(chatMessages.threadId, threadId)).orderBy(desc(chatMessages.createdAt), desc(chatMessages.id)).limit(6),
    db.select().from(chatThreads).where(and(eq(chatThreads.id, threadId), eq(chatThreads.userId, userId))),
    db.select({ subscribed: users.receiveNewsletter }).from(users).where(eq(users.id, userId)),
    db.select({ summary: chatThreads.summary }).from(chatThreads).where(and(eq(chatThreads.userId, userId), ne(chatThreads.id, threadId), ne(chatThreads.summary, ''))).orderBy(desc(chatThreads.updatedAt)).limit(2),
    db.select({ id: aiActions.id, payload: aiActions.payload }).from(aiActions).where(and(eq(aiActions.userId, userId), eq(aiActions.threadId, threadId), eq(aiActions.status, 'pending'), gt(aiActions.createdAt, new Date(Date.now() - 86400000)))),
  ]);
  if (!threads[0]) throw new AiError('Conversa não encontrada.', 404);
  const mentioned = petRows.filter((pet) => message.toLowerCase().includes(pet.name.toLowerCase())).map((pet) => pet.id);
  const relevant = memoryRows.filter((m) => !mentioned.length || mentioned.includes(m.petId));
  relevant.sort((a, b) => Number(b.category === 'health') - Number(a.category === 'health'));
  return { pets: petRows, memories: relevant.slice(0, 12), pendingActions, summary: threads[0].summary,
    previousSummaries: threads[0].summary ? [] : previousThreads.map((t) => t.summary.slice(0, 1000)),
    recent: messages.reverse().map((m) => ({ ...m, content: m.content.slice(0, 1500) })), newsletterSubscribed: profiles[0]?.subscribed || false };
}
export async function searchOffers(config: AiConfig, search: { query: string; petType: 'dogs' | 'cats' | 'all' }): Promise<Offer[]> {
  const now = new Date();
  const words = search.query.split(/\s+/).filter(Boolean).slice(0, 8);
  const matches = words.map((word) => {
    const pattern = `%${word.replace(/[\\%_]/g, '\\$&')}%`;
    return or(ilike(promotions.title, pattern), ilike(promotions.description, pattern), ilike(promotions.store, pattern));
  });
  return db.select({ id: promotions.id, title: promotions.title, store: promotions.store, priceCents: promotions.priceCents,
    originalPriceCents: promotions.originalPriceCents, currency: promotions.currency, coupon: promotions.coupon, affiliateUrl: promotions.affiliateUrl, endsAt: promotions.endsAt,
  }).from(promotions).where(and(eq(promotions.status, 'published'), lte(promotions.startsAt, now), gt(promotions.endsAt, now),
    gte(promotions.createdAt, new Date(now.getTime() - config.promotionsDays * 86400000)),
    search.petType === 'all' ? undefined : sql`${search.petType} = ANY(${promotions.petTypes})`, ...matches,
  )).orderBy(desc(promotions.createdAt), desc(promotions.id)).limit(config.promotionsLimit);
}
export function buildGraph(deps: { model: ModelCall; context: () => Promise<Context>; search: (search: NonNullable<ReturnType<typeof planSchema.parse>['search']>) => Promise<Offer[]>; saver: BaseCheckpointSaver }) {
  return new StateGraph(State)
    .addNode('load_context', async () => ({ context: await deps.context(), offers: [], plan: { search: null, actions: [] } }))
    .addNode('plan_turn', async (state) => {
      const plan = parsePlanResponse(await deps.model(PLAN, { context: state.context, message: state.message }));
      const ids = new Set(state.context.pets.map((pet) => pet.id));
      plan.actions = plan.actions.filter((action) => {
        const quote = action.kind === 'remember' ? action.memory.sourceQuote : action.sourceQuote;
        const petId = action.kind === 'remember' ? action.memory.petId : 'petId' in action ? action.petId : null;
        if (!explicitQuote(state.message, quote) || (petId && !ids.has(petId))) return false;
        if (action.kind === 'create_pet') {
          if (state.context.pets.some((pet) => pet.name.toLocaleLowerCase('pt-BR') === action.fields.name.toLocaleLowerCase('pt-BR'))) return false;
          // Optional birth data must never make a basic registration impossible.
          if ((action.fields.birthMonth == null) !== (action.fields.birthYear == null)) {
            delete action.fields.birthMonth; delete action.fields.birthYear;
          }
          try { validateBirth(action.fields); } catch { delete action.fields.birthMonth; delete action.fields.birthYear; }
        }
        if (action.kind === 'update_pet') {
          const pet = state.context.pets.find((item) => item.id === action.petId)!;
          try { validateBirth({ ...pet, ...action.fields }); } catch { return false; }
        }
        return !(state.context.pendingActions || []).some((pending) => {
          const previous = actionSchema.safeParse(pending.payload);
          if (!previous.success || previous.data.kind !== action.kind) return false;
          const withoutQuote = (value: typeof action) => {
            if (value.kind === 'remember') return { kind: value.kind, memory: { petId: value.memory.petId, category: value.memory.category, content: value.memory.content } };
            const { sourceQuote: _quote, ...proposal } = value;
            return proposal;
          };
          return JSON.stringify(withoutQuote(previous.data)) === JSON.stringify(withoutQuote(action));
        });
      });
      return { plan };
    })
    .addNode('tools', async (state) => ({ offers: state.plan.search ? await deps.search(state.plan.search) : [] }))
    .addNode('answer', async (state) => {
      const response = answerSchema.parse(await deps.model(`${SYSTEM}\nRetorne {answer:string,summary:string,promotionIds:string[]}. Resuma a conversa em até 2000 caracteres preservando incertezas e o status pendente das propostas. Escolha somente IDs das ofertas fornecidas. Estruture answer nesta ordem: resposta à dúvida atual; depois, se pertinente, UMA pergunta opcional OU uma proposta para confirmar, nunca ambos. Não anuncie botões que não existam em plan.actions ou context.pendingActions. Nenhuma ação desta rodada foi executada ainda. Preferências não médicas serão lembradas, sem alterar cadastro.`, state));
      const validIds = new Set(state.offers.map((offer) => offer.id));
      response.promotionIds = [...new Set(response.promotionIds)].filter((id) => validIds.has(id));
      return { response };
    })
    .addEdge(START, 'load_context').addEdge('load_context', 'plan_turn').addEdge('plan_turn', 'tools').addEdge('tools', 'answer').addEdge('answer', END)
    .compile({ checkpointer: deps.saver });
}
