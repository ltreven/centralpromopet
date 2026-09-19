export type PetType = 'dogs' | 'cats' | 'birds' | 'other';
export type Pet = { id: string; name: string; type: PetType; breed: string | null; birthMonth: number | null; birthYear: number | null; receiveUpdates: boolean };
export const petTypeLabels: Record<PetType, string> = { dogs: 'Cão', cats: 'Gato', birds: 'Pássaro', other: 'Outro pet' };
export const petTypeIcons: Record<PetType, string> = { dogs: '🐶', cats: '🐱', birds: '🐦', other: '🐾' };

export function approximateAge(pet: Pick<Pet, 'birthMonth' | 'birthYear'>) {
  if (!pet.birthMonth || !pet.birthYear) return null;
  const now = new Date();
  const months = Math.max(0, (now.getFullYear() - pet.birthYear) * 12 + (now.getMonth() + 1 - pet.birthMonth));
  if (months < 12) return `${months} ${months === 1 ? 'mês' : 'meses'}`;
  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;
  return `${years} ${years === 1 ? 'ano' : 'anos'}${remainingMonths ? ` e ${remainingMonths} ${remainingMonths === 1 ? 'mês' : 'meses'}` : ''}`;
}
