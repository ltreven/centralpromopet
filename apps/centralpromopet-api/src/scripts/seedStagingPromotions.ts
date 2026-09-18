import { client, db, demoPromotions, promotions } from '@centralpromopet/database';

async function seedStagingPromotions() {
  if (process.env.NODE_ENV !== 'production'
    || process.env.POD_NAMESPACE !== 'centralpromopet-staging'
    || process.env.STAGING_SEED_CONFIRMATION !== 'centralpromopet-staging') {
    throw new Error('This seed can run only from its explicitly enabled staging Job.');
  }
  const now = Date.now();
  const values = demoPromotions.map((offer) => ({
    ...offer,
    petTypes: [...offer.petTypes],
    startsAt: new Date(now - 60000),
    endsAt: new Date(now + 365 * 86400000),
  }));
  const inserted = await db.insert(promotions).values(values).onConflictDoNothing({ target: promotions.id }).returning({ id: promotions.id });
  console.log(`Staging catalog ready: ${inserted.length} new promotions; existing seed records were preserved.`);
}

seedStagingPromotions().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(() => client.end());
