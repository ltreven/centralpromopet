import { requireSession } from '@/lib/session';
import { PetsManager } from '@/components/pets-manager';

export default async function PetsPage({ searchParams }: { searchParams: Promise<{ dailyTips?: string }> }) {
  await requireSession();
  const params = await searchParams;
  return <PetsManager dailyTipsFlow={params.dailyTips === '1'} />;
}
