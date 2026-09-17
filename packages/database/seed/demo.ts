import { client, db, promotions } from '../src';
async function seed() {
  if (process.env.NODE_ENV === 'production') throw new Error('Demo seed is disabled in production');
  const now = Date.now();
  await db.insert(promotions).values({
    id: '00000000-0000-4000-8000-000000000001',
    title: 'Oferta demonstrativa — petisco para cães',
    description: 'Exemplo de desenvolvimento. Não representa uma oferta comercial.',
    store: 'Loja de demonstração', priceCents: 1990, originalPriceCents: 2990,
    affiliateUrl: 'https://example.com',
    startsAt: new Date(now - 60000), endsAt: new Date(now + 86400000), status: 'published',
  }).onConflictDoUpdate({ target: promotions.id, set: { startsAt: new Date(now - 60000), endsAt: new Date(now + 86400000) } });
}
seed().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => client.end());
