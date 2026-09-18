'use client';

import { FormEvent, useEffect, useState } from 'react';
import Image from 'next/image';
import { ArrowUpRight, Search, MessageCircle } from 'lucide-react';
import { SiteHeader } from '@/components/site-header';
import { Promotions, PetFilter } from '@/components/promotions';
import { Chatbot } from '@/components/chatbot';
import { Brand } from '@/components/brand';
import { site } from '@/lib/site';

const petFilters: { value: PetFilter; label: string; icon: string }[] = [
  { value: 'dogs', label: 'Cães', icon: '🐶' },
  { value: 'cats', label: 'Gatos', icon: '🐱' },
  { value: 'all', label: 'Tudo', icon: '✨' },
];

export function HomeLanding({ initialQuery, initialPet, shouldScrollToOffers }: { initialQuery: string; initialPet: PetFilter; shouldScrollToOffers: boolean }) {
  const [query, setQuery] = useState(initialQuery);
  const [activePet, setActivePet] = useState<PetFilter>(initialPet);
  useEffect(() => {
    if (shouldScrollToOffers) {
      requestAnimationFrame(() => document.getElementById('promocoes')?.scrollIntoView());
    }
  }, [shouldScrollToOffers]);

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
          <form className="home-search" role="search" onSubmit={submitSearch}>
            <Search size={21} aria-hidden="true" />
            <input aria-label="O que você procura?" type="search" placeholder="O que você procura?" value={query} onChange={(event) => setQuery(event.target.value)} />
            <button type="submit" aria-label="Buscar ofertas"><Search size={19} /></button>
          </form>
          <div className="pet-filter" aria-label="Filtrar promoções por pet">
            {petFilters.map((filter) => <button type="button" key={filter.value} className={activePet === filter.value ? 'pet-filter-button active' : 'pet-filter-button'} aria-pressed={activePet === filter.value} onClick={() => setActivePet(filter.value)}>
              <span aria-hidden="true">{filter.icon}</span>{filter.label}
            </button>)}
          </div>
          <a href={site.whatsappUrl} target="_blank" rel="noopener noreferrer" className="button primary whatsapp-button"><MessageCircle size={19} /> Entrar no Grupo VIP do WhatsApp <ArrowUpRight size={17} /></a>
        </div>
      </section>

      <section className="offers-section container" id="promocoes">
        <div className="section-heading offers-heading">
          <div><span className="eyebrow">SELECIONADOS PARA VOCÊ</span><h2>🔥 Garimpados de hoje</h2></div>
          <button type="button" className="text-link" onClick={() => { setQuery(''); setActivePet('all'); }}>Ver tudo <ArrowUpRight size={16} /></button>
        </div>
        <Promotions query={query} petFilter={activePet} />
        <p className="affiliate-note">Alguns links podem gerar uma comissão para a Central Promo Pet, sem custo adicional para você. Preços e disponibilidade são confirmados na loja.</p>
      </section>

      <section className="community container">
        <div><span className="eyebrow">NO SEU WHATSAPP</span><h2>Quer receber os melhores garimpos?</h2><p>Entre no Grupo VIP e receba promoções que valem a pena direto no WhatsApp.</p></div>
        <a href={site.whatsappUrl} target="_blank" rel="noopener noreferrer" className="button light"><MessageCircle size={19} /> Entrar no Grupo VIP <ArrowUpRight size={17} /></a>
      </section>
    </main>
    <footer className="container site-footer"><Brand /><span>Carinho pelo seu pet. Cuidado com seu bolso.</span><span>© {new Date().getFullYear()} Central Promo Pet</span></footer>
    <Chatbot />
  </>;
}
