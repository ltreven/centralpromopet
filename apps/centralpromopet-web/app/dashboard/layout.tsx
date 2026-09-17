import { Brand } from '@/components/brand';
import { Logout } from '@/components/logout';
import { requireSession } from '@/lib/session';
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  await requireSession();
  return <><header className="site-header container"><Brand /><Logout /></header><main className="container dashboard">{children}</main></>;
}
