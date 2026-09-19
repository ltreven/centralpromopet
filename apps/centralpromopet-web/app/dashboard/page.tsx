import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireSession } from '@/lib/session';
export default async function Dashboard() {
  const user = await requireSession();
  if (user.role !== 'admin') redirect('/');
  return <section className="auth-card account-card"><span className="eyebrow">MINHA CONTA</span><h1>Que bom ter você aqui.</h1><p>{user.email}</p><p>Personalize sua experiência cadastrando seus pets e encontre ofertas mais relevantes.</p><div className="hero-actions"><Link href="/dashboard/pets" className="button primary">Cadastrar meu pet</Link>{user.role === 'admin' && <><Link href="/dashboard/admin" className="button secondary">Produtos e promoções</Link><Link href="/dashboard/admin/users" className="button secondary">Usuários</Link></>}<Link href="/" className="button secondary">Ver promoções</Link></div></section>;
}
