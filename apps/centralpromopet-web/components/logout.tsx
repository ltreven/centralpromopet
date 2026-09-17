'use client';
import { useState } from 'react';
import { oneTapSuppressedKey } from '@/lib/google';
export function Logout() {
  const [error, setError] = useState('');
  async function logout() {
    try {
      const response = await fetch('/api/identity/logout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      if (!response.ok) throw new Error();
      window.google?.accounts.id.disableAutoSelect();
      try { sessionStorage.setItem(oneTapSuppressedKey, 'true'); } catch { /* No storage access required for logout. */ }
      window.location.assign('/');
    } catch { setError('Não foi possível sair. Tente novamente.'); }
  }
  return <><button className="button secondary" onClick={logout}>Sair</button>{error && <p role="alert">{error}</p>}</>;
}
