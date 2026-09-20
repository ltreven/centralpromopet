import { redirect } from 'next/navigation';
import { AdminTips } from '@/components/admin-tips';
import { requireSession } from '@/lib/session';

export default async function AdminTipsPage() {
  const user = await requireSession();
  if (user.role !== 'admin') redirect('/');
  return <section className="admin-page"><span className="eyebrow">ADMINISTRAÇÃO</span><h1>Dicas</h1><p className="admin-intro">Gerencie as dicas de bem-estar e treinamento exibidas na home.</p><AdminTips /></section>;
}
