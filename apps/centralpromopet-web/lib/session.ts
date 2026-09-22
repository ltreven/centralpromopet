import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { User, safeNext } from './user';
export type { User } from './user';
export async function requireSession(allowExpired = false, next?: string): Promise<User> {
  const suffix = safeNext(next) ? `?next=${encodeURIComponent(next!)}` : '';
  const cookie = (await cookies()).get('centralpromopet_session');
  if (!cookie) redirect(`/login${suffix}`);
  let response: Response;
  try {
    response = await fetch(`${process.env.API_URL || 'http://centralpromopet-api:4000'}/api/identity/me`, {
      headers: { Cookie: `${cookie.name}=${cookie.value}` }, cache: 'no-store', signal: AbortSignal.timeout(5000),
    });
  } catch { throw new Error('Não foi possível verificar sua sessão. Tente novamente.'); }
  if (response.status === 401) redirect(`/login${suffix}`);
  if (!response.ok) throw new Error('Não foi possível verificar sua sessão.');
  const { data: user } = await response.json() as { data: User };
  if (user.passwordExpired && !allowExpired) redirect(`/change-password${suffix}`);
  return user;
}
