import { requireSession } from '@/lib/session';
import { AiMemoryManager } from '@/components/ai-memory-manager';
export default async function MemoryPage() {
  await requireSession();
  return <section className="admin-page"><span className="eyebrow">MINHA CONTA</span><h1>O que a Central sabe sobre mim</h1><p className="admin-intro">Seus pets, preferências e conversas. Você escolhe o que fica guardado.</p><AiMemoryManager /></section>;
}
