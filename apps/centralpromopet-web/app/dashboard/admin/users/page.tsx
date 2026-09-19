import { redirect } from 'next/navigation';
import { AdminUsers } from '@/components/admin-users';
import { requireSession } from '@/lib/session';

export default async function AdminUsersPage() {
  const user = await requireSession();
  if (user.role !== 'admin') redirect('/');
  return <section className="admin-page">
    <span className="eyebrow">ADMINISTRAÇÃO</span>
    <h1>Usuários</h1>
    <p className="admin-intro">Cadastre acessos com senha temporária e altere nome, e-mail, status e perfil de cada pessoa.</p>
    <AdminUsers />
  </section>;
}
