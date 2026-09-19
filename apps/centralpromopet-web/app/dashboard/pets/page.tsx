import { requireSession } from '@/lib/session';
import { PetsManager } from '@/components/pets-manager';

export default async function PetsPage() {
  await requireSession();
  return <PetsManager />;
}
