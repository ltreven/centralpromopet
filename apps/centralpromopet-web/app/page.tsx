import { HomeLanding } from '@/components/home-landing';

export default async function Home({ searchParams }: { searchParams: Promise<{ q?: string; pet?: string }> }) {
  const params = await searchParams;
  const initialPet = params.pet === 'dogs' || params.pet === 'cats' || params.pet === 'all' ? params.pet : 'all';
  return <HomeLanding initialQuery={params.q || ''} initialPet={initialPet} shouldScrollToOffers={Boolean(params.q || params.pet)} />;
}
