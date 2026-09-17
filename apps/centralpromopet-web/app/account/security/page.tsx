import Link from 'next/link';
import { Brand } from '@/components/brand';
import { GoogleLink } from '@/components/google-link';
import { requireSession } from '@/lib/session';
export default async function AccountSecurity() {
  const user = await requireSession();
  return <main className="auth-shell"><Brand /><section className="auth-card"><span className="eyebrow">MINHA CONTA</span><h1>Segurança da conta</h1><p>{user.email}</p>
    <GoogleLink linked={user.googleLinked} googleEmail={user.googleEmail} hasPassword={user.hasPassword} />
    {user.hasPassword ? <Link className="text-link" href="/change-password">Alterar senha</Link> : <p>Você entra com Google. A senha dessa conta é gerenciada pelo Google.</p>}
    <p><Link className="text-link" href="/">Voltar às promoções</Link></p>
  </section></main>;
}
