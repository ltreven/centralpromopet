import { redirect } from 'next/navigation';
import { requireSession } from '@/lib/session';
import { AdminAiSettings } from '@/components/admin-ai-settings';
export default async function AiSettingsPage() {
  const user = await requireSession();
  if (user.role !== 'admin') redirect('/');
  return <section className="admin-page"><span className="eyebrow">ADMINISTRAÇÃO</span><h1>Configurações da IA</h1><p className="admin-intro">Modelo, conexão e limites das conversas e das promoções.</p><AdminAiSettings /></section>;
}
