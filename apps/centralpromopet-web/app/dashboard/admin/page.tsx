import { redirect } from 'next/navigation';
import { requireSession } from '@/lib/session';
export default async function Admin() {
  const user = await requireSession();
  if (user.role !== 'admin') redirect('/');
  return <section className="auth-card account-card"><span className="eyebrow">ADMINISTRAÇÃO</span><h1>Olá, administrador.</h1><p>Seu acesso administrativo está ativo.</p><p>A gestão de promoções e clientes será disponibilizada na próxima etapa.</p></section>;
}
