import { HomeLanding } from '@/components/home-landing';

export default async function Home({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const params = await searchParams;
  return <HomeLanding initialQuery={params.q || ''} shouldScrollToOffers={Boolean(params.q)} />;
}
