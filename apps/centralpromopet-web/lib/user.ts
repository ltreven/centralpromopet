export type User = {
  id: string; email: string; role: 'admin' | 'user'; passwordExpired: boolean;
  displayName: string | null; avatarUrl: string | null;
  hasPassword: boolean; googleLinked: boolean; googleEmail: string | null; receiveNewsletter: boolean;
};
export function safeNext(value: string | undefined) {
  return value && value.startsWith('/') && !value.startsWith('//') ? value : undefined;
}
export function loginDestination(user: Pick<User, 'role' | 'passwordExpired'>, next?: string) {
  const destination = safeNext(next);
  if (user.passwordExpired) return destination ? `/change-password?next=${encodeURIComponent(destination)}` : '/change-password';
  return destination || (user.role === 'admin' ? '/dashboard/admin' : '/');
}
