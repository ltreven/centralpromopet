'use client';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Brand } from '@/components/brand';
import { Logout } from '@/components/logout';
import { GoogleSignIn } from '@/components/google-sign-in';
import { User } from '@/lib/user';
export function SiteHeader() {
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);
  const accountMenuRef = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/identity/me', { cache: 'no-store', signal: controller.signal }).then(async (response) => {
      if (response.ok) setUser((await response.json()).data);
    }).catch(() => {}).finally(() => { if (!controller.signal.aborted) setChecking(false); });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    function closeOnOutsideClick(event: PointerEvent) {
      if (event.target instanceof Node && !accountMenuRef.current?.contains(event.target)) {
        accountMenuRef.current?.removeAttribute('open');
      }
    }
    document.addEventListener('pointerdown', closeOnOutsideClick);
    return () => document.removeEventListener('pointerdown', closeOnOutsideClick);
  }, []);
  const firstName = user?.displayName?.trim().split(/\s+/)[0] || user?.email.split('@')[0];
  return <>
    <header className="site-header container"><Brand /><nav aria-label="Menu principal">
      {checking ? <span className="session-check" role="status" aria-label="Verificando sessão" /> : user ? <details className="account-menu" ref={accountMenuRef}>
        <summary><span className="avatar">{user.avatarUrl ? <Image src={user.avatarUrl} alt="" width={36} height={36} referrerPolicy="no-referrer" /> : firstName?.charAt(0).toUpperCase()}</span><span>Olá, {firstName}</span><span aria-hidden="true">⌄</span></summary>
        <div className="account-menu-panel">
          <span className="account-role">{user.role === 'admin' ? 'Administrador' : 'Minha conta'}</span>
          {user.passwordExpired ? <Link href="/change-password">Trocar senha temporária</Link> : <>
            <Link href="/dashboard/pets">Meu Pet</Link>
            {user.role === 'admin' && <>
              <Link href="/dashboard/admin">Produtos e promoções</Link>
              <Link href="/dashboard/admin/users">Usuários</Link>
            </>}
          </>}
          <Logout />
        </div>
      </details> : <Link href="/login" className="button secondary">Entrar</Link>}
    </nav></header>
    {!checking && !user && <GoogleSignIn oneTapOnly />}
  </>;
}
