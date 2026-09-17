import { Router } from 'express';
import { and, desc, eq, gt, lte } from 'drizzle-orm';
import { db, promotions } from '@centralpromopet/database';

export const promotionsRouter = Router();
promotionsRouter.get('/today', async (_req, res, next) => {
  try {
    // Only currently valid offers: startsAt inclusive, endsAt exclusive, stored as timestamptz.
    const now = new Date();
    const data = await db.select().from(promotions).where(and(eq(promotions.status, 'published'), lte(promotions.startsAt, now), gt(promotions.endsAt, now))).orderBy(desc(promotions.startsAt)).limit(100);
    res.setHeader('Cache-Control', 'no-store');
    res.json({ success: true, data, meta: { timeZone: 'America/Sao_Paulo', asOf: now.toISOString(), currency: 'BRL' } });
  } catch (error) { next(error); }
});
