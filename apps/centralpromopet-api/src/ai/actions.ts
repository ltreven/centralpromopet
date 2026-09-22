import { and, eq } from 'drizzle-orm';
import { db, pets, users, aiMemories, aiActions, chatMessages, chatThreads, aiAudit } from '@centralpromopet/database';
import { actionSchema, PetAction, validateBirth } from './contracts';
import { AiError } from './config';
import { eraseConversationContext } from './storage';

export function actionLabel(action: PetAction, petName: string) {
  if (action.kind === 'subscribe_newsletter') return 'Receber por e-mail dicas de bem-estar e treinamento, novidades e promoções da Central.';
  if (action.kind === 'remember') return `Guardar sobre ${petName}: ${action.memory.content}`;
  if (action.kind === 'delete_pet') return `Excluir ${petName} e suas memórias. O histórico de conversas também será limpo para não reter dados desse pet.`;
  if (action.kind === 'create_pet') return `Cadastrar ${action.fields.name}: ${action.fields.type === 'dogs' ? 'cão' : 'gato'}${action.fields.breed ? `, raça ${action.fields.breed}` : ''}${action.fields.birthMonth && action.fields.birthYear ? `, nascimento ${String(action.fields.birthMonth).padStart(2, '0')}/${action.fields.birthYear}` : ', sem data de nascimento'}.`;
  const labels: Record<string, string> = { name: 'nome', type: 'tipo', breed: 'raça', birthMonth: 'mês de nascimento', birthYear: 'ano de nascimento' };
  const values: Record<string, string> = { dogs: 'cão', cats: 'gato', other: 'outro pet' };
  return `Atualizar ${petName}: ${Object.entries(action.fields).map(([key, value]) => `${labels[key]} = ${value == null ? 'não informado' : values[String(value)] || value}`).join('; ')}.`;
}
export async function decideAction(userId: string, id: string, approved: boolean) {
  const [original] = await db.select().from(aiActions).where(and(eq(aiActions.id, id), eq(aiActions.userId, userId)));
  if (!original) throw new AiError('Solicitação não encontrada.', 404);
  if (original.status !== 'pending') return { status: original.status, actionKind: actionSchema.parse(original.payload).kind, changed: false };
  if (Date.now() - original.createdAt.getTime() > 86400000) throw new AiError('Esta confirmação expirou. Faça o pedido novamente.');
  const action = actionSchema.parse(original.payload);
  const status = approved ? 'confirmed' : 'cancelled';
  let changed = false;
  await db.transaction(async (tx) => {
    const [claimed] = await tx.update(aiActions).set({ status }).where(and(eq(aiActions.id, id), eq(aiActions.userId, userId), eq(aiActions.status, 'pending'))).returning();
    if (!claimed) return;
    changed = true;
    if (approved) {
      const petId = action.kind === 'remember' ? action.memory.petId : 'petId' in action ? action.petId : null;
      const [pet] = petId ? await tx.select().from(pets).where(and(eq(pets.id, petId), eq(pets.userId, userId))).for('update') : [];
      if (petId && !pet) throw new AiError('O pet não existe mais no seu cadastro.', 404);
      if (action.kind === 'subscribe_newsletter') {
        await tx.update(users).set({ receiveNewsletter: true, updatedAt: new Date() }).where(eq(users.id, userId));
      } else if (action.kind === 'create_pet') {
        validateBirth(action.fields);
        await tx.insert(pets).values({ ...action.fields, userId });
      } else if (action.kind === 'update_pet') {
        validateBirth({ ...pet, ...action.fields });
        await tx.update(pets).set({ ...action.fields, updatedAt: new Date() }).where(and(eq(pets.id, action.petId), eq(pets.userId, userId)));
      } else if (action.kind === 'delete_pet') {
        await tx.delete(pets).where(and(eq(pets.id, action.petId), eq(pets.userId, userId)));
      } else {
        await tx.insert(aiMemories).values({ userId, ...action.memory });
      }
    }
    const completion = action.kind === 'create_pet' ? `${action.fields.name} foi cadastrado com sucesso.` : `Concluído: ${original.label}`;
    await tx.insert(chatMessages).values({ threadId: original.threadId, role: 'assistant', content: approved ? completion : 'Pedido cancelado. Não fiz essa alteração.' });
    // Stale summaries must never override newly corrected records.
    await tx.update(chatThreads).set({ summary: '', updatedAt: new Date() }).where(eq(chatThreads.userId, userId));
    await tx.insert(aiAudit).values({ userId, event: `chat.action.${status}`, details: { actionId: id, kind: action.kind } });
  });
  if (approved && action.kind === 'delete_pet') await eraseConversationContext(userId);
  return { status, actionKind: action.kind, changed };
}
