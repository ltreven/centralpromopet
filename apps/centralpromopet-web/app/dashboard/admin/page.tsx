import { redirect } from 'next/navigation';
import { requireSession } from '@/lib/session';
import { AdminDashboard } from '@/components/admin-dashboard';
export default async function Admin() {
  const user = await requireSession();
  if (user.role !== 'admin') redirect('/');
  return <section className="admin-page"><span className="eyebrow">ADMINISTRAÇÃO</span><h1>Dashboard</h1><p className="admin-intro">Acompanhe usuários, uso da IA, pets cadastrados e os últimos eventos da Central.</p><AdminDashboard /></section>;
}
