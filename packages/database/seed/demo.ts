import { client, db, demoPromotions, promotions } from '../src';
async function seed() {
  if (process.env.NODE_ENV === 'production') throw new Error('Demo seed is disabled in production');
  const now = Date.now();
  for (const offer of demoPromotions) {
    await db.insert(promotions).values({
      ...offer, petTypes: [...offer.petTypes],
      startsAt: new Date(now - 60000), endsAt: new Date(now + 365 * 86400000),
    }).onConflictDoUpdate({ target: promotions.id, set: {
      title: offer.title, description: offer.description, store: offer.store, currency: offer.currency,
      coupon: offer.coupon, storeVerified: offer.storeVerified, petTypes: [...offer.petTypes],
      priceCents: offer.priceCents, originalPriceCents: offer.originalPriceCents,
      affiliateUrl: offer.affiliateUrl, imageUrl: offer.imageUrl, status: offer.status,
      startsAt: new Date(now - 60000), endsAt: new Date(now + 365 * 86400000),
    } });
  }
  console.log(`Local development seed ready: ${demoPromotions.length} promotions.`);
}
seed().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => client.end());
