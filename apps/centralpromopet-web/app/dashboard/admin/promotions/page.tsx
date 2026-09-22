import { redirect } from 'next/navigation';
import { requireSession } from '@/lib/session';
import { AdminPromotions } from '@/components/admin-promotions';

export default async function AdminPromotionsPage() {
  const user = await requireSession();
  if (user.role !== 'admin') redirect('/');
  return <section className="admin-page"><span className="eyebrow">ADMINISTRAÇÃO</span><h1>Produtos e promoções</h1><p className="admin-intro">Cadastre ofertas para cães, gatos, pássaros ou outros pets.</p><AdminPromotions /></section>;
}
