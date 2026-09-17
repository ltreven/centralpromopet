export type User = {
  id: string; email: string; role: 'admin' | 'user'; passwordExpired: boolean;
  displayName: string | null; avatarUrl: string | null;
  hasPassword: boolean; googleLinked: boolean; googleEmail: string | null;
};
export function loginDestination(user: Pick<User, 'role' | 'passwordExpired'>) {
  return user.passwordExpired ? '/change-password' : user.role === 'admin' ? '/dashboard/admin' : '/';
}
