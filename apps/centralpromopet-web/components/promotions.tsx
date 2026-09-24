'use client';
import { useEffect, useState } from 'react';
import Image from 'next/image';
import { ArrowUpRight, PawPrint, Tag } from 'lucide-react';
type Promotion = { id: string; title: string; description: string | null; store: string; currency: string; imageUrl: string | null; coupon: string | null; storeVerified: boolean; priceCents: number; originalPriceCents: number | null; affiliateUrl: string; endsAt: string };
const money = (cents: number, currency = 'BRL') => new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(cents / 100);
function safeUrl(url: string) { try { return new URL(url).protocol === 'https:' ? url : null; } catch { return null; } }
export function Promotions({ query }: { query: string }) {
  const [offers, setOffers] = useState<Promotion[]>([]);
  const [visibleCounts, setVisibleCounts] = useState<Record<string, number>>({});
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
  const normalized = query.trim().toLocaleLowerCase('pt-BR');
  const filterKey = normalized;
  const visibleCount = visibleCounts[filterKey] || 9;
  const filteredOffers = offers.filter((offer) => {
    const searchable = `${offer.title} ${offer.description || ''} ${offer.store} ${offer.coupon || ''}`.toLocaleLowerCase('pt-BR');
    return !normalized || searchable.includes(normalized);
  });
  if (!filteredOffers.length) return <div className="empty-state"><span className="icon-bubble"><Tag size={26} /></span><h3>{offers.length ? 'Não encontramos ofertas com esse termo.' : 'Os próximos garimpos estão a caminho.'}</h3><p>{offers.length ? 'Tente buscar por outro nome de produto, loja ou cupom.' : 'Enquanto isso, entre no Grupo VIP para receber os próximos achadinhos.'}</p></div>;
  const visibleOffers = filteredOffers.slice(0, visibleCount);
  return <>
    <div className="offers-grid">{visibleOffers.map((offer) => {
    const discount = offer.originalPriceCents ? Math.round((1 - offer.priceCents / offer.originalPriceCents) * 100) : 0;
    return <article className="offer-card" key={offer.id}>
      <div className="product-image"><span className="product-image-placeholder"><PawPrint size={30} /> Imagem do produto</span>{offer.imageUrl && <Image src={offer.imageUrl} alt={offer.title} fill unoptimized sizes="(max-width: 600px) 100vw, 33vw" onError={(event) => { event.currentTarget.style.display = 'none'; }} />}</div>
      <div className="offer-storeline"><span>{offer.store}</span>{offer.storeVerified && <span className="verified-store">✓ Loja verificada</span>}</div>
      <h3>{offer.title}</h3>
      <div className="price">
        {offer.originalPriceCents && <div className="price-before"><span>❌ De:</span><del>{money(offer.originalPriceCents, offer.currency)}</del></div>}
        <div className="price-after"><span>✅ Por:</span><strong>{money(offer.priceCents, offer.currency)}</strong>{discount > 0 && <span className="discount-pill">-{discount}%</span>}</div>
      </div>
      {offer.coupon && <p className="offer-coupon">Cupom: <strong>{offer.coupon}</strong></p>}
      <small>{offer.store}</small>
      {safeUrl(offer.affiliateUrl) && <a href={offer.affiliateUrl} target="_blank" rel="noopener noreferrer sponsored" className="button primary offer-link">Ver oferta <ArrowUpRight size={17} /></a>}
    </article>;
    })}</div>
    {visibleOffers.length < filteredOffers.length && <div className="offers-load-more"><button className="button secondary" type="button" onClick={() => setVisibleCounts((current) => ({ ...current, [filterKey]: visibleCount + 9 }))}>Carregar mais</button></div>}
  </>;
}
