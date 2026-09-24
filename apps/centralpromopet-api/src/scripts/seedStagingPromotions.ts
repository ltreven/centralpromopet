import { client, db, demoPromotions, demoTips, promotions, tips } from '@centralpromopet/database';
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
  for (const tip of demoTips) {
    await db.insert(tips).values(tip).onConflictDoUpdate({ target: tips.id, set: {
      title: tip.title, content: tip.content, category: tip.category, updatedAt: new Date(now),
    } });
  }
  console.log(`Staging catalog ready: ${synced} promotion seed rows and ${demoTips.length} tips synchronized.`);
}

seedStagingPromotions().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(() => client.end());
