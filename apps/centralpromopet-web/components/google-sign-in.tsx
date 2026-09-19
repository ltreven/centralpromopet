'use client';
import Script from 'next/script';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { GoogleCredential, oneTapSuppressedKey } from '@/lib/google';
import { loginDestination, User } from '@/lib/user';

type Config = { enabled: boolean; clientId: string | null; oneTapEnabled: boolean };
export function GoogleSignIn({ oneTapOnly = false, mode = 'login', password = '', onLinked, next }: {
  oneTapOnly?: boolean; mode?: 'login' | 'link'; password?: string; onLinked?: () => void; next?: string;
}) {
  const router = useRouter();
  const [config, setConfig] = useState<Config | null>(null);
  const [sdkReady, setSdkReady] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const button = useRef<HTMLDivElement>(null);
  const passwordRef = useRef(password);
  const onLinkedRef = useRef(onLinked);
  useEffect(() => { passwordRef.current = password; onLinkedRef.current = onLinked; }, [password, onLinked]);
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/identity/google/config', { cache: 'no-store', signal: controller.signal })
      .then(async (response) => { if (!response.ok) throw new Error(); setConfig((await response.json()).data); })
      .catch((err) => { if (err.name !== 'AbortError' && !oneTapOnly) setError('O login com Google está temporariamente indisponível.'); });
    return () => controller.abort();
  }, [oneTapOnly]);

  useEffect(() => {
    const google = window.google?.accounts.id;
    if (!sdkReady || !google || !config?.enabled || !config.clientId) return;
    let cancelled = false;
    let submitting = false;
    const controller = new AbortController();
    const base = mode === 'link' ? '/api/identity/google/link' : '/api/identity/google';
    async function acceptCredential({ credential }: GoogleCredential) {
      if (cancelled || submitting) return;
      submitting = true; setBusy(true); setError('');
      try {
        const response = await fetch(base, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ credential, ...(mode === 'link' ? { password: passwordRef.current } : {}) }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || 'Não foi possível entrar com Google.');
        if (cancelled) return;
        if (mode === 'link') { onLinkedRef.current?.(); router.refresh(); }
        else {
          try { sessionStorage.removeItem(oneTapSuppressedKey); } catch { /* Storage may be unavailable. */ }
          // Full navigation also refreshes the anonymous landing header after One Tap.
          window.location.assign(loginDestination(result.data.user as User, next));
        }
      } catch (err) { if (!cancelled) setError(err instanceof Error ? err.message : 'Não foi possível entrar com Google.'); }
      finally { if (!cancelled) setBusy(false); submitting = false; }
    }
    fetch(`${base}/challenge`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}', signal: controller.signal })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || 'Não foi possível iniciar o login com Google.');
        if (cancelled) return;
        google!.initialize({ client_id: config!.clientId!, nonce: result.data.nonce, callback: acceptCredential,
          auto_select: false, ux_mode: 'popup', use_fedcm_for_button: true, button_auto_select: false });
        if (!oneTapOnly && button.current) {
          button.current.replaceChildren();
          google!.renderButton(button.current, { type: 'standard', theme: 'outline', size: 'large', text: 'continue_with', shape: 'pill', locale: 'pt-BR', width: String(Math.min(button.current.clientWidth || 260, 320)) });
        }
        let suppressed = false;
        try { suppressed = sessionStorage.getItem(oneTapSuppressedKey) === 'true'; } catch { /* No automatic selection either way. */ }
        if (mode === 'login' && config!.oneTapEnabled && location.protocol === 'https:' && !suppressed) google!.prompt();
      })
      .catch((err) => { if (!cancelled && err.name !== 'AbortError') setError(err.message || 'Não foi possível iniciar o login com Google.'); });
    return () => { cancelled = true; controller.abort(); google.cancel(); };
  }, [config, sdkReady, attempt, mode, oneTapOnly, router, next]);

  if (config && !config.enabled) return mode === 'link' ? <p>O login com Google ainda não está disponível.</p> : null;
  return <>
    {config?.enabled && <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" onReady={() => setSdkReady(true)} onError={() => setError('Não foi possível carregar o Google. Verifique sua conexão ou use sua senha.')} />}
    {!oneTapOnly && config?.enabled && <div className="google-sign-in" aria-busy={busy}>
      <div ref={button} className={busy ? 'google-button google-button-busy' : 'google-button'} />
      {!sdkReady && <p role="status">Carregando login com Google…</p>}
      {mode === 'login' && <small>No primeiro acesso, criamos sua conta de cliente.</small>}
      {busy && <p role="status">Confirmando seu acesso…</p>}
    </div>}
    {error && <div className={oneTapOnly ? 'google-notice' : 'form-error'} role="alert">
      <p>{error}</p>
      {oneTapOnly ? <Link href="/login" className="text-link">Ir para o login</Link> : <button type="button" className="text-link" onClick={() => { setError(''); setAttempt(attempt + 1); }}>Tentar novamente</button>}
    </div>}
  </>;
}
