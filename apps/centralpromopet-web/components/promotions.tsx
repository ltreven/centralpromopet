'use client';
import { useEffect, useState } from 'react';
import { ArrowUpRight, Tag } from 'lucide-react';
type Promotion = { id: string; title: string; description: string | null; store: string; priceCents: number; originalPriceCents: number | null; affiliateUrl: string; endsAt: string };
const money = (cents: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
function safeUrl(url: string) { try { return new URL(url).protocol === 'https:' ? url : null; } catch { return null; } }
export function Promotions() {
  const [offers, setOffers] = useState<Promotion[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/promotions/today', { signal: controller.signal, cache: 'no-store' }).then(async (response) => {
      if (!response.ok) throw new Error('Unable to load');
      const result = await response.json();
      setOffers(result.data); setStatus('ready');
    }).catch((error) => { if (error.name !== 'AbortError') setStatus('error'); });
    return () => controller.abort();
  }, [attempt]);
  if (status === 'loading') return <div className="empty-state" role="status">Buscando as promoções de hoje…</div>;
  if (status === 'error') return <div className="empty-state" role="status"><h3>Não conseguimos carregar as ofertas.</h3><p>Você ainda pode acompanhar as novidades no nosso grupo.</p><button className="button secondary" onClick={() => { setStatus('loading'); setAttempt(attempt + 1); }}>Tentar novamente</button></div>;
  if (!offers.length) return <div className="empty-state"><span className="icon-bubble"><Tag size={26} /></span><h3>As próximas ofertas estão a caminho.</h3><p>Enquanto isso, entre no grupo e acompanhe os achadinhos para o seu pet.</p></div>;
  return <div className="offers-grid">{offers.map((offer) => <article className="offer-card" key={offer.id}><span className="eyebrow">{offer.store}</span><h3>{offer.title}</h3>{offer.description && <p>{offer.description}</p>}<div className="price">{offer.originalPriceCents && <del>{money(offer.originalPriceCents)}</del>}<strong>{money(offer.priceCents)}</strong></div><small>Válida até {new Date(offer.endsAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })} (Brasília)</small>{safeUrl(offer.affiliateUrl) && <a href={offer.affiliateUrl} target="_blank" rel="noopener noreferrer sponsored" className="button primary">Ver na loja <ArrowUpRight size={18} /></a>}</article>)}</div>;
}
