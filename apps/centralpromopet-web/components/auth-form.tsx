'use client';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { loginDestination } from '@/lib/user';
export function AuthForm({ changePassword = false, next }: { changePassword?: boolean; next?: string }) {
  const router = useRouter();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError('');
    const form = new FormData(event.currentTarget);
    if (changePassword && form.get('newPassword') !== form.get('confirmPassword')) return setError('As novas senhas precisam ser iguais.');
    setLoading(true);
    const body = changePassword ? { oldPassword: form.get('password'), newPassword: form.get('newPassword') } : { email: form.get('email'), password: form.get('password') };
    try {
      const response = await fetch(`/api/identity/${changePassword ? 'change-password' : 'login'}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'Não foi possível continuar.');
      const user = changePassword ? await fetch('/api/identity/me', { cache: 'no-store' }).then(async (response) => { if (!response.ok) throw new Error('Não foi possível verificar sua sessão.'); return (await response.json()).data; }) : result.data.user;
      const destination = loginDestination(user, next);
      if (destination === '/') window.location.assign('/');
      else { router.replace(destination); router.refresh(); }
    } catch (err) { setError(err instanceof Error ? err.message : 'Não foi possível continuar.'); }
    finally { setLoading(false); }
  }
  return <form className="auth-form" onSubmit={submit}>
    {error && <p className="form-error" role="alert">{error}</p>}
    {!changePassword && <label>E-mail<input name="email" type="email" autoComplete="username" required maxLength={255} /></label>}
    <label>{changePassword ? 'Senha atual ou temporária' : 'Senha'}<input name="password" type="password" autoComplete="current-password" required maxLength={256} /></label>
    {changePassword && <><label>Nova senha<input name="newPassword" type="password" autoComplete="new-password" minLength={12} maxLength={72} required /></label><small>Use pelo menos 12 caracteres. Não reutilize a senha temporária.</small><label>Confirme a nova senha<input name="confirmPassword" type="password" autoComplete="new-password" minLength={12} maxLength={72} required /></label></>}
    <button className="button primary" disabled={loading} type="submit">{loading ? 'Aguarde…' : changePassword ? 'Salvar nova senha' : 'Entrar'}</button>
  </form>;
}
