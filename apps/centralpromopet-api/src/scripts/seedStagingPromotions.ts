import { client, db, demoPromotions, promotions } from '@centralpromopet/database';
import { isNull, like, or } from 'drizzle-orm';

async function seedStagingPromotions() {
  if (process.env.NODE_ENV !== 'production'
    || process.env.POD_NAMESPACE !== 'centralpromopet-staging'
    || process.env.STAGING_SEED_CONFIRMATION !== 'centralpromopet-staging') {
    throw new Error('This seed can run only from its explicitly enabled staging Job.');
  }
  const now = Date.now();
  let synced = 0;
  for (const offer of demoPromotions) {
    const values = {
      ...offer,
      petTypes: [...offer.petTypes],
      startsAt: new Date(now - 60000),
      endsAt: new Date(now + 365 * 86400000),
    };
    const result = offer.imageUrl
      ? await db.insert(promotions).values(values).onConflictDoUpdate({
        target: promotions.id,
        set: { imageUrl: offer.imageUrl, updatedAt: new Date(now) },
        // Refresh only our old seed placeholders (or a missing image), never a manually edited image.
        setWhere: or(isNull(promotions.imageUrl), like(promotions.imageUrl, '/promotions/%')),
      }).returning({ id: promotions.id })
      : await db.insert(promotions).values(values).onConflictDoNothing({ target: promotions.id }).returning({ id: promotions.id });
    synced += result.length;
  }
  console.log(`Staging catalog ready: ${synced} seed rows inserted or image placeholders refreshed; custom images were preserved.`);
}

seedStagingPromotions().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(() => client.end());
