import { SiteHeader } from '@/components/site-header';
import { requireSession } from '@/lib/session';
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  await requireSession();
  return <><SiteHeader /><main className="container dashboard">{children}</main></>;
}
