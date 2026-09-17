'use client';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return <main className="auth-shell"><section className="auth-card"><h1>Não foi possível carregar esta página.</h1><p>Tente novamente em alguns instantes.</p><button className="button primary" onClick={reset}>Tentar novamente</button></section></main>;
}
