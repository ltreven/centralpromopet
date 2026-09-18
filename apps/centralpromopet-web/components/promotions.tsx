'use client';
import { useEffect, useState } from 'react';
import Image from 'next/image';
import { ArrowUpRight, PawPrint, Tag } from 'lucide-react';
type Promotion = { id: string; title: string; description: string | null; store: string; currency: string; imageUrl: string | null; coupon: string | null; storeVerified: boolean; petTypes: ('dogs' | 'cats' | 'birds' | 'other')[]; priceCents: number; originalPriceCents: number | null; affiliateUrl: string; endsAt: string };
export type PetFilter = 'dogs' | 'cats' | 'birds' | 'other' | 'all';
const petLabels = { dogs: 'Cães', cats: 'Gatos', birds: 'Pássaros', other: 'Outros pets' };
const money = (cents: number, currency = 'BRL') => new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(cents / 100);
function safeUrl(url: string) { try { return new URL(url).protocol === 'https:' ? url : null; } catch { return null; } }
export function Promotions({ query, petFilter }: { query: string; petFilter: PetFilter }) {
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
  const normalized = query.trim().toLocaleLowerCase('pt-BR');
  const filteredOffers = offers.filter((offer) => {
    const matchesPet = petFilter === 'all' || offer.petTypes.includes(petFilter);
    const searchable = `${offer.title} ${offer.description || ''} ${offer.store} ${offer.coupon || ''}`.toLocaleLowerCase('pt-BR');
    return matchesPet && (!normalized || searchable.includes(normalized));
  });
  if (!filteredOffers.length) return <div className="empty-state"><span className="icon-bubble"><Tag size={26} /></span><h3>{offers.length ? 'Não encontramos ofertas com esse filtro.' : 'Os próximos garimpos estão a caminho.'}</h3><p>{offers.length ? 'Tente outro termo ou escolha outro tipo de pet.' : 'Enquanto isso, entre no Grupo VIP para receber os próximos achadinhos.'}</p></div>;
  return <div className="offers-grid">{filteredOffers.map((offer) => {
    const discount = offer.originalPriceCents ? Math.round((1 - offer.priceCents / offer.originalPriceCents) * 100) : 0;
    return <article className="offer-card" key={offer.id}>
      <div className="product-image"><span className="product-image-placeholder"><PawPrint size={30} /> Imagem do produto</span>{offer.imageUrl && <Image src={offer.imageUrl} alt={offer.title} fill unoptimized sizes="(max-width: 600px) 100vw, 33vw" onError={(event) => { event.currentTarget.style.display = 'none'; }} />}</div>
      <div className="offer-storeline"><span>{offer.store}</span>{offer.storeVerified && <span className="verified-store">✓ Loja verificada</span>}</div>
      <h3>{offer.title}</h3>
      <div className="pet-tags">{offer.petTypes.map((pet) => <span key={pet}>{petLabels[pet]}</span>)}</div>
      <div className="price"><strong>{money(offer.priceCents, offer.currency)}</strong>{offer.originalPriceCents && <><del>{money(offer.originalPriceCents, offer.currency)}</del>{discount > 0 && <span className="discount-pill">-{discount}%</span>}</>}</div>
      {offer.coupon && <p className="offer-coupon">Cupom: <strong>{offer.coupon}</strong></p>}
      <small>{offer.store}</small>
      {safeUrl(offer.affiliateUrl) && <a href={offer.affiliateUrl} target="_blank" rel="noopener noreferrer sponsored" className="button primary offer-link">Ver oferta <ArrowUpRight size={17} /></a>}
    </article>;
  })}</div>;
}
