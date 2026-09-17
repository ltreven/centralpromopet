import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { User } from './user';
export type { User } from './user';
export async function requireSession(allowExpired = false): Promise<User> {
  const cookie = (await cookies()).get('centralpromopet_session');
  if (!cookie) redirect('/login');
  let response: Response;
  try {
    response = await fetch(`${process.env.API_URL || 'http://centralpromopet-api:4000'}/api/identity/me`, {
      headers: { Cookie: `${cookie.name}=${cookie.value}` }, cache: 'no-store', signal: AbortSignal.timeout(5000),
    });
  } catch { throw new Error('Não foi possível verificar sua sessão. Tente novamente.'); }
  if (response.status === 401) redirect('/login');
  if (!response.ok) throw new Error('Não foi possível verificar sua sessão.');
  const { data: user } = await response.json() as { data: User };
  if (user.passwordExpired && !allowExpired) redirect('/change-password');
  return user;
}
