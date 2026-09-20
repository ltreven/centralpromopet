import { Router } from 'express';
import { desc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db, tips } from '@centralpromopet/database';
import { requireAdmin, requireAuth, requireCurrentPassword } from '../auth';

export const tipsRouter = Router();
const tipSchema = z.object({
  title: z.string().trim().min(1, 'Informe o título da dica.').max(200),
  content: z.string().trim().min(1, 'Informe o conteúdo da dica.').max(2000),
  category: z.enum(['wellness', 'training']),
}).strict();
const tipIdSchema = z.string().uuid();
const adminOnly = [requireAuth, requireCurrentPassword, requireAdmin];

tipsRouter.get('/random', async (_req, res, next) => {
  try {
    const [data] = await db.select({ id: tips.id, title: tips.title, content: tips.content, category: tips.category }).from(tips).orderBy(sql`random()`).limit(1);
    res.setHeader('Cache-Control', 'no-store');
    if (!data) return res.status(404).json({ success: false, message: 'Nenhuma dica publicada.' });
    res.json({ success: true, data });
  } catch (error) { next(error); }
});

tipsRouter.get('/', async (_req, res, next) => {
  try {
    const data = await db.select({ id: tips.id, title: tips.title, content: tips.content, category: tips.category }).from(tips).orderBy(desc(tips.createdAt)).limit(100);
    res.setHeader('Cache-Control', 'no-store');
    res.json({ success: true, data });
  } catch (error) { next(error); }
});

tipsRouter.get('/admin', ...adminOnly, async (_req, res, next) => {
  try {
    const data = await db.select().from(tips).orderBy(desc(tips.createdAt)).limit(200);
    res.setHeader('Cache-Control', 'no-store');
    res.json({ success: true, data });
  } catch (error) { next(error); }
});

tipsRouter.post('/', ...adminOnly, async (req, res, next) => {
  const parsed = tipSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, message: parsed.error.issues[0]?.message || 'Confira os dados da dica.' });
  try {
    const [data] = await db.insert(tips).values(parsed.data).returning();
    res.status(201).json({ success: true, data });
  } catch (error) { next(error); }
});

tipsRouter.patch('/:id', ...adminOnly, async (req, res, next) => {
  const id = tipIdSchema.safeParse(req.params.id);
  if (!id.success) return res.status(400).json({ success: false, message: 'Identificador de dica inválido.' });
  const parsed = tipSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, message: parsed.error.issues[0]?.message || 'Confira os dados da dica.' });
  try {
    const [data] = await db.update(tips).set({ ...parsed.data, updatedAt: new Date() }).where(eq(tips.id, id.data)).returning();
    if (!data) return res.status(404).json({ success: false, message: 'Dica não encontrada.' });
    res.json({ success: true, data });
  } catch (error) { next(error); }
});

tipsRouter.delete('/:id', ...adminOnly, async (req, res, next) => {
  const id = tipIdSchema.safeParse(req.params.id);
  if (!id.success) return res.status(400).json({ success: false, message: 'Identificador de dica inválido.' });
  try {
    const [data] = await db.delete(tips).where(eq(tips.id, id.data)).returning({ id: tips.id });
    if (!data) return res.status(404).json({ success: false, message: 'Dica não encontrada.' });
    res.json({ success: true, data });
  } catch (error) { next(error); }
});
