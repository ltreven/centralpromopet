'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowUpRight, Sparkles, Lightbulb, Search, MessageCircle, X } from 'lucide-react';
import { SiteHeader } from '@/components/site-header';
import { Promotions } from '@/components/promotions';
import { Brand } from '@/components/brand';
import { site } from '@/lib/site';
import { User } from '@/lib/user';

type PetTip = { id: string; title: string; content: string; category: 'wellness' | 'training' };
const fallbackTip: PetTip = { id: 'fallback', title: 'Você sabia que brincar também é cuidar?', content: 'Brincadeiras diárias ajudam a reduzir o estresse e mantêm cães e gatos ativos e felizes.', category: 'wellness' };

export function HomeLanding({ initialQuery, shouldScrollToOffers }: { initialQuery: string; shouldScrollToOffers: boolean }) {
  const [query, setQuery] = useState(initialQuery);
  const [user, setUser] = useState<User | null>(null);
  const [featuredTip, setFeaturedTip] = useState<PetTip>(fallbackTip);
  const [productSearchOpen, setProductSearchOpen] = useState(Boolean(initialQuery));
  const dailyTipsHref = user ? (user.passwordExpired ? '/change-password?next=%2Fdashboard%2Fpets%3FdailyTips%3D1' : '/dashboard/pets?dailyTips=1') : '/login?next=%2Fdashboard%2Fpets%3FdailyTips%3D1';
  const productSearchInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (productSearchOpen) productSearchInput.current?.focus();
  }, [productSearchOpen]);
  useEffect(() => {
    if (shouldScrollToOffers) {
      requestAnimationFrame(() => document.getElementById('promocoes')?.scrollIntoView());
    }
  }, [shouldScrollToOffers]);
  useEffect(() => {
    fetch('/api/identity/me', { cache: 'no-store' }).then(async (response) => response.ok ? setUser((await response.json()).data) : undefined).catch(() => {});
  }, []);
  useEffect(() => {
    fetch('/api/tips/random', { cache: 'no-store' }).then(async (response) => response.ok ? (await response.json()).data as PetTip : null).then((tip) => { if (tip) setFeaturedTip(tip); }).catch(() => {});
  }, []);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    document.getElementById('promocoes')?.scrollIntoView({ behavior: 'smooth' });
  }

  return <>
    <a className="skip-link" href="#conteudo">Pular para o conteúdo</a>
    <SiteHeader />
    <main id="conteudo">
      <section className="search-hero">
        <div className="search-hero-content container">
          <Image className="hero-logo" src="/logo.webp" width={112} height={112} alt="Central Promo Pet" priority />
          <h1>A gente garimpa.<br /><span>Você economiza.</span></h1>
          <p>As melhores promoções para o seu pet, encontradas todos os dias.</p>
          <div className="search-hero-actions">
            <a href={site.whatsappUrl} target="_blank" rel="noopener noreferrer" className="button primary whatsapp-button"><MessageCircle size={18} aria-hidden="true" /> Entrar no Grupo VIP do WhatsApp <ArrowUpRight size={16} aria-hidden="true" /></a>
            <Link href="/chat" className="button secondary assistant-cta"><Sparkles size={19} aria-hidden="true" /> IA da Central <ArrowUpRight size={16} aria-hidden="true" /></Link>
          </div>
          <aside className="hero-tip" id="dicas">
            <Lightbulb size={19} aria-hidden="true" />
            <div><strong>{featuredTip.title}</strong><p>{featuredTip.content}</p><Link href={dailyTipsHref}>Receber dicas por e-mail <ArrowUpRight size={13} aria-hidden="true" /></Link></div>
          </aside>
        </div>
      </section>

      <section className="offers-section container" id="promocoes">
        <div className="section-heading offers-heading">
          <div><span className="eyebrow">SELECIONADOS PARA VOCÊ</span><h2>🔥 Garimpados de hoje</h2></div>
        </div>
        <div className="offer-controls">
          {productSearchOpen ? <form className="home-search" role="search" onSubmit={submitSearch}>
            <Search size={21} aria-hidden="true" />
            <input ref={productSearchInput} aria-label="O que você procura?" type="search" placeholder="O que você procura?" value={query} onChange={(event) => setQuery(event.target.value)} />
            <button type="button" className="home-search-close" aria-label="Fechar busca de produtos" onClick={() => { setQuery(''); setProductSearchOpen(false); }}><X size={19} /></button>
          </form> : <button type="button" className="home-search-toggle" aria-label="Buscar produtos" aria-expanded="false" onClick={() => setProductSearchOpen(true)}><Search size={21} /></button>}
        </div>
        <Promotions query={query} />
        <p className="affiliate-note">Alguns links podem gerar uma comissão para a Central Promo Pet, sem custo adicional para você. Preços e disponibilidade são confirmados na loja.</p>
      </section>

      <section className="community container">
        <div><span className="eyebrow">NO SEU WHATSAPP</span><h2>Quer receber os melhores garimpos?</h2><p>Entre no Grupo VIP e receba as melhores promoções direto no WhatsApp.</p></div>
        <a href={site.whatsappUrl} target="_blank" rel="noopener noreferrer" className="button light">Entrar no Grupo VIP <ArrowUpRight size={17} /></a>
      </section>
      <section className="pet-invite container">
        <div><span className="eyebrow">DO JEITINHO DELE</span><h2>Quer receber novidades para o seu pet?</h2><p>Cadastre seu companheiro e receba dicas de bem estar e treinamento no seu e-mail.</p></div>
        <Link href={user ? (user.passwordExpired ? '/change-password?next=%2Fdashboard%2Fpets' : '/dashboard/pets') : '/login?next=%2Fdashboard%2Fpets'} className="button primary">Cadastrar meu pet <ArrowUpRight size={17} /></Link>
      </section>
    </main>
    <footer className="container site-footer"><Brand /><span>Carinho pelo seu pet. Cuidado com seu bolso.</span><span>© {new Date().getFullYear()} Central Promo Pet</span></footer>
  </>;
}
