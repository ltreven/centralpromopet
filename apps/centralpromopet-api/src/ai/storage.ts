import { db, client, aiUsage, chatThreads, chatMessages, aiMemories, aiActions } from '@centralpromopet/database';
import { and, eq, sql } from 'drizzle-orm';
import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';
import { AiError } from './config';

let saver: PostgresSaver | undefined;
export const checkpointer = () => saver ||= PostgresSaver.fromConnString(process.env.DATABASE_URL || 'postgres://centralpromopet:centralpromopet@127.0.0.1:5433/centralpromopet', { schema: 'ai_checkpoints' });
export async function closeCheckpointer() { if (saver) { await saver.end(); saver = undefined; } }

// Serializes model turns, confirmations and erasure across all API replicas.
export async function withUserLock<T>(userId: string, work: () => Promise<T>): Promise<T> {
  const connection = await client.reserve();
  let locked = false;
  try {
    const [row] = await connection`select pg_try_advisory_lock(hashtextextended(${userId}, 0)) as locked`;
    locked = row.locked;
    if (!locked) throw new AiError('Uma solicitação sua ainda está em andamento. Aguarde um instante.', 409);
    return await work();
  } finally {
    try { if (locked) await connection`select pg_advisory_unlock(hashtextextended(${userId}, 0))`; }
    finally { connection.release(); }
  }
}
export async function consumeQuota(userId: string, limit: number, scope = 'chat') {
  const id = `${userId}:${scope}:${new Date().toISOString().slice(0, 10)}`;
  const [row] = await db.insert(aiUsage).values({ id, userId, requests: 1 }).onConflictDoUpdate({
    target: aiUsage.id, set: { requests: sql`${aiUsage.requests} + 1` }, setWhere: sql`${aiUsage.requests} < ${limit}`,
  }).returning();
  if (!row) throw new AiError('Seu limite diário de mensagens foi atingido. Volte amanhã.', 429);
}
export async function ownedThread(userId: string, id: string) {
  const [thread] = await db.select().from(chatThreads).where(and(eq(chatThreads.id, id), eq(chatThreads.userId, userId)));
  if (!thread) throw new AiError('Conversa não encontrada.', 404);
  return thread;
}
export async function eraseThread(userId: string, id: string) {
  await ownedThread(userId, id);
  await checkpointer().deleteThread(id);
  await db.delete(chatThreads).where(and(eq(chatThreads.id, id), eq(chatThreads.userId, userId)));
}
export async function eraseConversationContext(userId: string) {
  // Erasing a memory must not let an old summary/checkpoint recreate it.
  const threads = await db.select({ id: chatThreads.id }).from(chatThreads).where(eq(chatThreads.userId, userId));
  for (const thread of threads) {
    await checkpointer().deleteThread(thread.id);
    await db.delete(chatMessages).where(eq(chatMessages.threadId, thread.id));
    await db.delete(aiActions).where(eq(aiActions.threadId, thread.id));
  }
  await db.update(chatThreads).set({ summary: '', title: 'Conversa limpa', updatedAt: new Date() }).where(eq(chatThreads.userId, userId));
}
export async function eraseAll(userId: string) {
  await eraseConversationContext(userId);
  await db.delete(aiMemories).where(eq(aiMemories.userId, userId));
  await db.delete(chatThreads).where(eq(chatThreads.userId, userId));
}
