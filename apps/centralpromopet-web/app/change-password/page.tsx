import { Brand } from '@/components/brand';
import { AuthForm } from '@/components/auth-form';
import { requireSession } from '@/lib/session';
import { redirect } from 'next/navigation';
export default async function ChangePassword() {
  const user = await requireSession(true);
  if (!user.hasPassword) redirect('/account/security');
  return <main className="auth-shell"><Brand /><section className="auth-card"><span className="eyebrow">PROTEJA SUA CONTA</span><h1>Escolha uma nova senha</h1><p>Substitua sua senha temporária para continuar.</p><AuthForm changePassword /></section></main>;
}
