import { Annotation, StateGraph, START, END } from '@langchain/langgraph';
import type { BaseCheckpointSaver } from '@langchain/langgraph-checkpoint';
import { and, desc, eq, ne, gte, lte, gt, ilike, or } from 'drizzle-orm';
import { db, users, pets, aiMemories, aiActions, chatMessages, promotions, chatThreads } from '@centralpromopet/database';
import { AiConfig, AiError } from './config';
import { ModelCall } from './provider';
import { planSchema, actionSchema, answerSchema, parsePlanResponse, PLAN, SYSTEM, explicitQuote, validateBirth } from './contracts';
import type { PetAction } from './contracts';

const aiDebugEnabled = process.env.AI_DEBUG === 'true';
function logAiTiming(stage: string, startedAt: number, metadata: Record<string, boolean | number | string> = {}) {
  if (!aiDebugEnabled) return;
  console.debug('[ai-debug]', JSON.stringify({ stage, duration_ms: Math.round(performance.now() - startedAt), ...metadata }));
}
export async function timedAiStage<T>(stage: string, operation: () => Promise<T>, details?: (result: T) => Record<string, boolean | number | string>): Promise<T> {
  const startedAt = performance.now();
  let result: T | undefined;
  let outcome = 'ok';
  try {
    result = await operation();
    return result;
  } catch (error) {
    outcome = 'error';
    throw error;
  } finally {
    logAiTiming(stage, startedAt, { outcome, ...(result === undefined ? {} : details?.(result) || {}) });
  }
}

export type Offer = Pick<typeof promotions.$inferSelect, 'id' | 'title' | 'store' | 'priceCents' | 'originalPriceCents' | 'currency' | 'coupon' | 'affiliateUrl' | 'endsAt'>;
type PetContext = typeof pets.$inferSelect & { ageMonthsFromBirthMonth: number | null };
export type Context = { userName: string | null; currentDate: string; pets: PetContext[]; memories: (typeof aiMemories.$inferSelect)[]; summary: string; previousSummaries: string[]; recent: { role: string; content: string }[]; newsletterSubscribed: boolean; pendingActions?: { id: string; payload: Record<string, unknown> }[] };
function normalizeEvidence(value: string) {
  return value.toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
}
function supportedSearchQuery(search: NonNullable<ReturnType<typeof planSchema.parse>['search']>, message: string, recent: Context['recent']) {
  if (!search.query.trim()) return { ...search, query: '', evidence: '' };
  const evidence = search.evidence?.trim() || '';
  const userText = [message, ...recent.filter((item) => item.role === 'user').map((item) => item.content)].map(normalizeEvidence).join(' ');
  const normalizedEvidence = normalizeEvidence(evidence);
  const queryWords = normalizeEvidence(search.query).split(' ').filter(Boolean);
  const evidenceWords = new Set(normalizedEvidence.split(' ').filter(Boolean).map((word) => word.replace(/s$/, '')));
  const supported = Boolean(normalizedEvidence && userText.includes(normalizedEvidence)
    && queryWords.some((word) => evidenceWords.has(word.replace(/s$/, ''))));
  return supported ? search : { ...search, query: '', evidence: '' };
}
function newsletterStatusReply(message: string, subscribed: boolean) {
  const text = message.toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const asksAboutEmail = /\b(newsletter|e[ -]?mail|dicas? por e?mail)\b/.test(text);
  const asksStatus = /\b(receb\w*|inscrit\w*|assinad\w*|ativ\w*|opt[ -]?in|verific\w*|cadastro|status)\b/.test(text);
  const requestsSubscription = /\b(aceito|inscrev\w*|pode ativar|ative|ativar para mim|quero receber|gostaria de receber)\b/.test(text);
  if (!asksAboutEmail || !asksStatus || requestsSubscription) return null;
  return subscribed
    ? 'Sim. O cadastro da sua conta indica que você está inscrito para receber dicas por e-mail. Essa preferência vale para a conta, não individualmente para cada pet.'
    : 'Não. O cadastro da sua conta indica que o recebimento de dicas por e-mail está desativado. Essa preferência vale para a conta, não individualmente para cada pet.';
}

function applyEstimatedBirth(fields: { birthMonth?: number | null; birthYear?: number | null }, ageMonths: number) {
  const today = new Date();
  const estimate = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - ageMonths, 1));
  fields.birthMonth = estimate.getUTCMonth() + 1;
  fields.birthYear = estimate.getUTCFullYear();
}

export const State = Annotation.Root({
  message: Annotation<string>(), context: Annotation<Context>(),
  plan: Annotation<ReturnType<typeof planSchema.parse>>(), offers: Annotation<Offer[]>(),
  response: Annotation<ReturnType<typeof answerSchema.parse>>(), steering: Annotation<string>(), automaticSearch: Annotation<boolean>(), directReply: Annotation<string>(),
});
export async function loadContext(userId: string, threadId: string, message = ''): Promise<Context> {
  const [petRows, memoryRows, messages, threads, profiles, previousThreads, pendingActions] = await Promise.all([
    db.select().from(pets).where(eq(pets.userId, userId)),
    db.select().from(aiMemories).where(eq(aiMemories.userId, userId)).orderBy(desc(aiMemories.createdAt)).limit(100),
    db.select({ role: chatMessages.role, content: chatMessages.content }).from(chatMessages).where(eq(chatMessages.threadId, threadId)).orderBy(desc(chatMessages.createdAt), desc(chatMessages.id)).limit(6),
    db.select().from(chatThreads).where(and(eq(chatThreads.id, threadId), eq(chatThreads.userId, userId))),
    db.select({ subscribed: users.receiveNewsletter, displayName: users.displayName }).from(users).where(eq(users.id, userId)),
    db.select({ summary: chatThreads.summary }).from(chatThreads).where(and(eq(chatThreads.userId, userId), ne(chatThreads.id, threadId), ne(chatThreads.summary, ''))).orderBy(desc(chatThreads.updatedAt)).limit(2),
    db.select({ id: aiActions.id, payload: aiActions.payload }).from(aiActions).where(and(eq(aiActions.userId, userId), eq(aiActions.threadId, threadId), eq(aiActions.status, 'pending'), gt(aiActions.createdAt, new Date(Date.now() - 86400000)))),
  ]);
  if (!threads[0]) throw new AiError('Conversa não encontrada.', 404);
  const mentioned = petRows.filter((pet) => message.toLowerCase().includes(pet.name.toLowerCase())).map((pet) => pet.id);
  const relevant = memoryRows.filter((m) => !mentioned.length || mentioned.includes(m.petId));
  relevant.sort((a, b) => Number(b.category === 'health') - Number(a.category === 'health'));
  const now = new Date();
  const currentMonthIndex = now.getUTCFullYear() * 12 + now.getUTCMonth();
  const contextPets: PetContext[] = petRows.map((pet) => ({ ...pet,
    ageMonthsFromBirthMonth: pet.birthMonth != null && pet.birthYear != null
      ? Math.max(0, currentMonthIndex - (pet.birthYear * 12 + pet.birthMonth - 1))
      : null,
  }));
  return { userName: profiles[0]?.displayName || null, currentDate: now.toISOString().slice(0, 10), pets: contextPets, memories: relevant.slice(0, 12), pendingActions, summary: threads[0].summary,
    previousSummaries: threads[0].summary ? [] : previousThreads.map((t) => t.summary.slice(0, 1000)),
    recent: messages.reverse().map((m) => ({ ...m, content: m.content.slice(0, 1500) })), newsletterSubscribed: profiles[0]?.subscribed || false };
}
export async function searchOffers(config: AiConfig, search: { query: string }): Promise<Offer[]> {
  const now = new Date();
  const ignoredWords = new Set(['a', 'as', 'o', 'os', 'de', 'da', 'do', 'das', 'dos', 'para', 'pra', 'por', 'com', 'em', 'no', 'na']);
  const synonyms: Record<string, string[]> = {
    roupinha: ['roupa'], roupinhas: ['roupa'], roupas: ['roupa'],
    cachorros: ['cachorro'], cães: ['cao', 'cachorro'], caes: ['cão', 'cachorro'], cão: ['cao', 'cachorro'],
    gatos: ['gato'], gatinhos: ['gato'], gatinho: ['gato'],
  };
  const words = [...new Set(search.query.split(/\s+/)
    .map((word) => word.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ''))
    .filter((word) => Boolean(word) && !ignoredWords.has(word.toLocaleLowerCase('pt-BR')))
    .slice(0, 8))];
  const matches = words.map((word) => {
    const normalized = word.toLocaleLowerCase('pt-BR');
    const variants = [...new Set([word, ...(synonyms[normalized] || []), ...(normalized.normalize('NFD').replace(/[\u0300-\u036f]/g, '') === 'racao' ? ['ração', 'racao'] : [])])];
    return or(...variants.flatMap((variant) => {
      const pattern = `%${variant.replace(/[\\%_]/g, '\\$&')}%`;
      return [ilike(promotions.title, pattern), ilike(promotions.description, pattern), ilike(promotions.store, pattern), ilike(promotions.coupon, pattern)];
    }));
  });
  // Query terms are alternatives, not mandatory tokens: modifiers like species, age, or size
  // often do not appear in a product title.
  const textMatch = matches.length ? or(...matches) : undefined;
  return db.select({ id: promotions.id, title: promotions.title, store: promotions.store, priceCents: promotions.priceCents,
    originalPriceCents: promotions.originalPriceCents, currency: promotions.currency, coupon: promotions.coupon, affiliateUrl: promotions.affiliateUrl, endsAt: promotions.endsAt,
  }).from(promotions).where(and(eq(promotions.status, 'published'), lte(promotions.startsAt, now), gt(promotions.endsAt, now),
    gte(promotions.createdAt, new Date(now.getTime() - config.promotionsDays * 86400000)),
    textMatch,
  )).orderBy(desc(promotions.createdAt), desc(promotions.id)).limit(config.promotionsLimit);
}
export function buildGraph(deps: { model: ModelCall; context: () => Promise<Context>; search: (search: NonNullable<ReturnType<typeof planSchema.parse>['search']>) => Promise<Offer[]>; saver: BaseCheckpointSaver }) {
  return new StateGraph(State)
    .addNode('load_context', async () => {
      const context = await timedAiStage('load_context', deps.context);
      return { context, offers: [], plan: { search: null, actions: [] }, steering: '', automaticSearch: false, directReply: '' };
    })
    .addNode('plan_turn', async (state) => {
      const profileReply = newsletterStatusReply(state.message, state.context.newsletterSubscribed);
      if (profileReply) return { plan: { search: null, actions: [] }, steering: '', automaticSearch: false, directReply: profileReply };
      const modelPlan = await timedAiStage('planner_model', () => deps.model(PLAN, {
        context: state.context,
        message: state.message,
      }));
      const plan = parsePlanResponse(modelPlan);
      if (plan.search) plan.search = supportedSearchQuery(plan.search, state.message, state.context.recent);
      const ids = new Set(state.context.pets.map((pet) => pet.id));
      // Don't let a repeat registration block useful new details for an existing pet.
      // Convert only into a proposal for fields that are currently absent.
      plan.actions = plan.actions.flatMap<PetAction>((action) => {
        if (action.kind !== 'create_pet') return [action];
        const existing = state.context.pets.find((pet) => pet.name.toLocaleLowerCase('pt-BR') === action.fields.name.toLocaleLowerCase('pt-BR'));
        if (!existing || existing.type !== action.fields.type) return [action];
        const fields: { breed?: string | null; birthMonth?: number | null; birthYear?: number | null } = {};
        if (action.fields.breed && !existing.breed) fields.breed = action.fields.breed;
        const missingBirth = existing.birthMonth == null || existing.birthYear == null;
        if (missingBirth && action.fields.birthMonth != null && action.fields.birthYear != null) {
          fields.birthMonth = action.fields.birthMonth;
          fields.birthYear = action.fields.birthYear;
        }
        if (Object.keys(fields).length) return [{ kind: 'update_pet' as const, petId: existing.id, fields, sourceQuote: action.sourceQuote }];
        if (missingBirth && action.estimated && action.ageMonths !== undefined) {
          return [{ kind: 'update_pet' as const, petId: existing.id, fields: {}, estimated: true, ageMonths: action.ageMonths, sourceQuote: action.sourceQuote }];
        }
        return [];
      });
      plan.actions = plan.actions.filter((action) => {
        if (action.kind === 'subscribe_newsletter' && state.context.newsletterSubscribed) return false;
        let quote = action.kind === 'remember' ? action.memory.sourceQuote : action.sourceQuote;
        if (!explicitQuote(state.message, quote) && (action.kind === 'create_pet' || action.kind === 'update_pet')) {
          const previousAssistant = [...state.context.recent].reverse().find((entry) => entry.role === 'assistant')?.content || '';
          const answeredNamePrompt = /\b(nome|como se chama|qual o nome)\b/i.test(previousAssistant) && previousAssistant.includes('?');
          const askedToConfirmProposal = /\b(proposta|cadastro)\b/i.test(previousAssistant) && previousAssistant.includes('?');
          const affirmative = /^(sim|pode|claro|ok|okay|isso|pode sim|por favor)[.!\s]*$/i.test(state.message.trim());
          const petName = action.kind === 'create_pet' ? action.fields.name : state.context.pets.find((pet) => pet.id === action.petId)?.name;
          const currentMessageHasName = Boolean(petName && state.message.toLocaleLowerCase('pt-BR').includes(petName.toLocaleLowerCase('pt-BR')));
          if (answeredNamePrompt && currentMessageHasName) {
            action.sourceQuote = state.message.trim();
            quote = action.sourceQuote;
          } else if (askedToConfirmProposal && affirmative) {
            action.sourceQuote = state.message.trim();
            quote = action.sourceQuote;
          }
        }
        const petId = action.kind === 'remember' ? action.memory.petId : 'petId' in action ? action.petId : null;
        if (!explicitQuote(state.message, quote) || (petId && !ids.has(petId))) return false;
        if (action.kind === 'create_pet') {
          if (state.context.pets.some((pet) => pet.name.toLocaleLowerCase('pt-BR') === action.fields.name.toLocaleLowerCase('pt-BR'))) return false;
          if (action.ageMonths !== undefined && !action.estimated) return false;
          if (action.estimated) {
            if (action.ageMonths === undefined) return false;
            applyEstimatedBirth(action.fields, action.ageMonths);
          }
          // Optional birth data must never make a basic registration impossible.
          if ((action.fields.birthMonth == null) !== (action.fields.birthYear == null)) {
            delete action.fields.birthMonth; delete action.fields.birthYear;
          }
          try { validateBirth(action.fields); } catch { delete action.fields.birthMonth; delete action.fields.birthYear; }
        }
        if (action.kind === 'update_pet') {
          const pet = state.context.pets.find((item) => item.id === action.petId)!;
          if (action.ageMonths !== undefined && !action.estimated) return false;
          if (action.estimated) {
            if (action.ageMonths === undefined) return false;
            applyEstimatedBirth(action.fields, action.ageMonths);
          }
          if (Object.entries(action.fields).every(([key, value]) => pet[key as keyof typeof pet] === value)) return false;
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
      const steering = [
        'Responda normalmente em português brasileiro.',
        'Use no máximo 2 frases curtas (cerca de 240 caracteres no total). Não faça listas nem repita a pergunta do usuário. Só dê mais detalhes se ele pedir.',
        plan.search ? 'O usuário pediu recomendação de produto: consulte as promoções fornecidas e mencione brevemente as opções encontradas. Se não houver resultados, diga isso com clareza; nunca invente produto ou oferta.' : '',
      ].filter(Boolean).join(' ');
      return { plan, steering, automaticSearch: Boolean(plan.search), directReply: '' };
    })
    .addNode('tools', async (state) => {
      if (!state.plan.search) return { offers: [] };
      const offers = await timedAiStage('offer_search', () => deps.search(state.plan.search!), (result) => ({ result_count: result.length }));
      return { offers };
    })
    .addNode('answer', async (state) => {
      if (state.directReply) return { response: { answer: state.directReply, summary: state.context.summary, promotionIds: [] } };
      const modelAnswer = await timedAiStage('answer_model', () => deps.model(`${SYSTEM}\n${state.steering}\nRetorne {answer:string,summary:string,promotionIds:string[]}. Resuma a conversa em até 2000 caracteres preservando incertezas e o status pendente das propostas. Escolha somente IDs das ofertas fornecidas. Estruture answer nesta ordem: resposta à dúvida atual; depois, se pertinente, UMA pergunta opcional OU uma proposta para confirmar, nunca ambos. Se plan.actions contiver uma proposta, diga para confirmar no botão abaixo; não pergunte também “quer que eu confirme?” nem espere um segundo sim por texto. Não anuncie botões que não existam em plan.actions ou context.pendingActions. Nenhuma ação desta rodada foi executada ainda. Preferências não médicas serão lembradas, sem alterar cadastro.`, state));
      const response = answerSchema.parse(modelAnswer);
      const validIds = new Set(state.offers.map((offer) => offer.id));
      response.promotionIds = [...new Set(response.promotionIds)].filter((id) => validIds.has(id));
      if (state.automaticSearch) {
        response.promotionIds = state.offers.slice(0, 4).map((offer) => offer.id);
      }
      return { response };
    })
    .addEdge(START, 'load_context').addEdge('load_context', 'plan_turn').addEdge('plan_turn', 'tools').addEdge('tools', 'answer').addEdge('answer', END)
    .compile({ checkpointer: deps.saver });
}
