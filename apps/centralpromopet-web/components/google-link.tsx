'use client';
import { FormEvent, useState } from 'react';
import { GoogleSignIn } from '@/components/google-sign-in';
export function GoogleLink({ linked, googleEmail, hasPassword }: { linked: boolean; googleEmail: string | null; hasPassword: boolean }) {
  const [password, setPassword] = useState('');
  const [choosing, setChoosing] = useState(false);
  const [success, setSuccess] = useState(false);
  if (linked || success) return <p role="status">Sua conta Google está vinculada{googleEmail ? `: ${googleEmail}` : ''}. Você já pode usá-la para entrar.</p>;
  if (!hasPassword) return null;
  function confirm(event: FormEvent) { event.preventDefault(); setChoosing(true); }
  return <div className="google-link"><h2>Vincular conta Google</h2><p>Confirme sua senha atual e escolha a conta Google que deseja usar para entrar.</p>
    {!choosing ? <form onSubmit={confirm} className="auth-form"><label>Senha atual<input type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} /></label><button className="button secondary" type="submit">Escolher conta Google</button></form> : <>
      <GoogleSignIn mode="link" password={password} onLinked={() => { setSuccess(true); setPassword(''); }} />
      <button className="text-link" onClick={() => { setChoosing(false); setPassword(''); }}>Usar outra senha</button>
    </>}
  </div>;
}
