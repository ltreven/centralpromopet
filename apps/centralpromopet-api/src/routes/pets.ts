import { Router, Request } from 'express';
import { and, asc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db, pets, users } from '@centralpromopet/database';
import { AuthenticatedRequest, requireAuth, requireCurrentPassword } from '../auth';
import { logActivity } from '../activity';

export const petsRouter = Router();
petsRouter.use(requireAuth, requireCurrentPassword);

const petSchema = z.object({
  name: z.string().trim().min(1, 'Informe o nome do pet.').max(80, 'O nome deve ter no máximo 80 caracteres.'),
  type: z.enum(['dogs', 'cats', 'birds', 'other'], { message: 'Escolha um tipo de pet válido.' }),
  breed: z.preprocess((value) => value === '' ? null : value, z.string().trim().max(100, 'A raça deve ter no máximo 100 caracteres.').nullable().optional()),
  birthMonth: z.number().int().min(1).max(12).nullable().optional(),
  birthYear: z.number().int().min(1900).max(new Date().getFullYear()).nullable().optional(),
  receiveUpdates: z.boolean().default(false),
}).superRefine((value, context) => {
  if ((value.birthMonth == null) !== (value.birthYear == null)) context.addIssue({ code: z.ZodIssueCode.custom, path: ['birthMonth'], message: 'Informe mês e ano de nascimento juntos, ou deixe os dois em branco.' });
});
const petIdSchema = z.string().uuid();
const currentUserId = (req: Request) => (req as AuthenticatedRequest).user.id;

petsRouter.get('/', async (req, res, next) => {
  try {
    const data = await db.select().from(pets).where(eq(pets.userId, currentUserId(req))).orderBy(asc(pets.createdAt));
    res.setHeader('Cache-Control', 'no-store');
    res.json({ success: true, data });
  } catch (error) { next(error); }
});

petsRouter.post('/', async (req, res, next) => {
  const parsed = petSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, message: parsed.error.issues[0]?.message || 'Confira os dados do pet.' });
  try {
    const [data] = await db.insert(pets).values({ ...parsed.data, userId: currentUserId(req) }).returning();
    if (parsed.data.receiveUpdates) await db.update(users).set({ receiveNewsletter: true, updatedAt: new Date() }).where(eq(users.id, currentUserId(req)));
    await logActivity({ userId: currentUserId(req), event: 'pet.create', entityType: 'pet', entityId: data.id, details: { type: data.type } });
    res.status(201).json({ success: true, data });
  } catch (error) { next(error); }
});

petsRouter.patch('/:id', async (req, res, next) => {
  const id = petIdSchema.safeParse(req.params.id);
  if (!id.success) return res.status(400).json({ success: false, message: 'Identificador de pet inválido.' });
  const parsed = petSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, message: parsed.error.issues[0]?.message || 'Confira os dados do pet.' });
  try {
    const [data] = await db.update(pets).set({ ...parsed.data, updatedAt: new Date() }).where(and(eq(pets.id, id.data), eq(pets.userId, currentUserId(req)))).returning();
    if (!data) return res.status(404).json({ success: false, message: 'Pet não encontrado.' });
    if (parsed.data.receiveUpdates) await db.update(users).set({ receiveNewsletter: true, updatedAt: new Date() }).where(eq(users.id, currentUserId(req)));
    await logActivity({ userId: currentUserId(req), event: 'pet.update', entityType: 'pet', entityId: data.id, details: { type: data.type } });
    res.json({ success: true, data });
  } catch (error) { next(error); }
});

petsRouter.delete('/:id', async (req, res, next) => {
  const id = petIdSchema.safeParse(req.params.id);
  if (!id.success) return res.status(400).json({ success: false, message: 'Identificador de pet inválido.' });
  try {
    const [data] = await db.delete(pets).where(and(eq(pets.id, id.data), eq(pets.userId, currentUserId(req)))).returning({ id: pets.id });
    if (!data) return res.status(404).json({ success: false, message: 'Pet não encontrado.' });
    await logActivity({ userId: currentUserId(req), event: 'pet.delete', entityType: 'pet', entityId: data.id });
    res.json({ success: true, data });
  } catch (error) { next(error); }
});
