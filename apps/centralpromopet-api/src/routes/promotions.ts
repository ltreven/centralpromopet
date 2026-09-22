import { Router } from 'express';
import { and, desc, eq, gt, lte } from 'drizzle-orm';
import { db, promotions } from '@centralpromopet/database';
import { z } from 'zod';
import { AuthenticatedRequest, requireAdmin, requireAuth, requireCurrentPassword } from '../auth';
import { logActivity } from '../activity';

export const promotionsRouter = Router();

const money = z.string().trim().regex(/^\d{1,7}(?:[,.]\d{1,2})?$/, 'Informe um preço válido.');
const createPromotionSchema = z.object({
  title: z.string().trim().min(1).max(200),
  store: z.string().trim().min(1).max(100),
  currency: z.string().trim().regex(/^[A-Z]{3}$/).default('BRL'),
  coupon: z.string().trim().max(100).optional().default(''),
  imageUrl: z.string().trim().max(2048).optional().default('').refine((value) => !value || (value.startsWith('https://') || (value.startsWith('/promotions/') && !value.includes('..'))), 'Use uma imagem HTTPS ou um arquivo em /promotions/.'),
  storeVerified: z.boolean(),
  petTypes: z.array(z.enum(['dogs', 'cats', 'birds', 'other'])).min(1).max(4)
    .refine((values) => new Set(values).size === values.length, 'Remova categorias repetidas.'),
  originalPrice: z.union([money, z.literal('')]).optional().default(''),
  promotionalPrice: money,
  affiliateUrl: z.string().url().max(2048).refine((value) => value.startsWith('https://'), 'O link precisa usar HTTPS.'),
  endsAt: z.string().datetime({ offset: true }),
  status: z.enum(['draft', 'published']),
}).refine((value) => !value.originalPrice || moneyToCents(value.originalPrice) >= moneyToCents(value.promotionalPrice), {
  path: ['originalPrice'], message: 'O preço original deve ser igual ou maior que o promocional.',
}).refine((value) => new Date(value.endsAt).getTime() > Date.now(), {
  path: ['endsAt'], message: 'A validade precisa terminar no futuro.',
});
const promotionIdSchema = z.string().uuid();

function moneyToCents(value: string) {
  const [whole, fraction = ''] = value.replace(',', '.').split('.');
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
}

promotionsRouter.get('/today', async (_req, res, next) => {
  try {
    // Only currently valid offers: startsAt inclusive, endsAt exclusive, stored as timestamptz.
    const now = new Date();
    const data = await db.select().from(promotions).where(and(eq(promotions.status, 'published'), lte(promotions.startsAt, now), gt(promotions.endsAt, now))).orderBy(desc(promotions.startsAt)).limit(100);
    res.setHeader('Cache-Control', 'no-store');
    res.json({ success: true, data, meta: { timeZone: 'America/Sao_Paulo', asOf: now.toISOString(), currency: 'BRL' } });
  } catch (error) { next(error); }
});

promotionsRouter.get('/admin', requireAuth, requireCurrentPassword, requireAdmin, async (_req, res, next) => {
  try {
    const data = await db.select().from(promotions).orderBy(desc(promotions.createdAt)).limit(200);
    res.setHeader('Cache-Control', 'no-store');
    res.json({ success: true, data });
  } catch (error) { next(error); }
});

promotionsRouter.post('/', requireAuth, requireCurrentPassword, requireAdmin, async (req, res, next) => {
  try {
    const parsed = createPromotionSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, message: parsed.error.issues[0]?.message || 'Confira os dados da promoção.' });
    const value = parsed.data;
    const [data] = await db.insert(promotions).values({
      title: value.title,
      store: value.store,
      currency: value.currency,
      coupon: value.coupon || null,
      imageUrl: value.imageUrl || null,
      storeVerified: value.storeVerified,
      petTypes: value.petTypes,
      originalPriceCents: value.originalPrice ? moneyToCents(value.originalPrice) : null,
      priceCents: moneyToCents(value.promotionalPrice),
      affiliateUrl: value.affiliateUrl,
      startsAt: new Date(),
      endsAt: new Date(value.endsAt),
      status: value.status,
    }).returning();
    void logActivity({ userId: (req as AuthenticatedRequest).user.id, event: 'admin.promotion.create', entityType: 'promotion', entityId: data.id, details: { status: data.status } });
    res.status(201).json({ success: true, data });
  } catch (error) { next(error); }
});

promotionsRouter.patch('/:id', requireAuth, requireCurrentPassword, requireAdmin, async (req, res, next) => {
  try {
    const id = promotionIdSchema.safeParse(req.params.id);
    if (!id.success) return res.status(400).json({ success: false, message: 'Identificador de promoção inválido.' });
    const parsed = createPromotionSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, message: parsed.error.issues[0]?.message || 'Confira os dados da promoção.' });
    const value = parsed.data;
    const [data] = await db.update(promotions).set({
      title: value.title,
      store: value.store,
      currency: value.currency,
      coupon: value.coupon || null,
      imageUrl: value.imageUrl || null,
      storeVerified: value.storeVerified,
      petTypes: value.petTypes,
      originalPriceCents: value.originalPrice ? moneyToCents(value.originalPrice) : null,
      priceCents: moneyToCents(value.promotionalPrice),
      affiliateUrl: value.affiliateUrl,
      endsAt: new Date(value.endsAt),
      status: value.status,
      updatedAt: new Date(),
    }).where(eq(promotions.id, id.data)).returning();
    if (!data) return res.status(404).json({ success: false, message: 'Promoção não encontrada.' });
    void logActivity({ userId: (req as AuthenticatedRequest).user.id, event: 'admin.promotion.update', entityType: 'promotion', entityId: data.id, details: { status: data.status } });
    res.json({ success: true, data });
  } catch (error) { next(error); }
});

promotionsRouter.delete('/:id', requireAuth, requireCurrentPassword, requireAdmin, async (req, res, next) => {
  try {
    const id = promotionIdSchema.safeParse(req.params.id);
    if (!id.success) return res.status(400).json({ success: false, message: 'Identificador de promoção inválido.' });
    const [data] = await db.delete(promotions).where(eq(promotions.id, id.data)).returning({ id: promotions.id });
    if (!data) return res.status(404).json({ success: false, message: 'Promoção não encontrada.' });
    void logActivity({ userId: (req as AuthenticatedRequest).user.id, event: 'admin.promotion.delete', entityType: 'promotion', entityId: data.id });
    res.json({ success: true, data });
  } catch (error) { next(error); }
});
