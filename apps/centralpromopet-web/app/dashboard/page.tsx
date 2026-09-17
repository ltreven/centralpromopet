import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireSession } from '@/lib/session';
export default async function Dashboard() {
  const user = await requireSession();
  if (user.role !== 'admin') redirect('/');
  return <section className="auth-card account-card"><span className="eyebrow">MINHA CONTA</span><h1>Que bom ter você aqui.</h1><p>{user.email}</p><p>Seu acesso está pronto. O cadastro de pets será disponibilizado em breve.</p><div className="hero-actions">{user.role === 'admin' && <Link href="/dashboard/admin" className="button primary">Administração</Link>}<Link href="/" className="button secondary">Ver promoções</Link><Link href="/account/security" className="text-link">Segurança da conta</Link></div></section>;
}
