import Image from 'next/image';
import { ArrowDown, ArrowUpRight, Heart, MessageCircle, PawPrint, Tag } from 'lucide-react';
import { Brand } from '@/components/brand';
import { SiteHeader } from '@/components/site-header';
import { Promotions } from '@/components/promotions';
import { site } from '@/lib/site';
export default function Home() {
  return <>
    <a className="skip-link" href="#conteudo">Pular para o conteúdo</a>
    <SiteHeader />
    <main id="conteudo">
      <section className="hero container"><div className="hero-copy"><span className="eyebrow"><PawPrint size={16} /> BOM PARA O PET. MELHOR PARA O BOLSO.</span><h1>Mais carinho.<br />Mais <span>economia.</span></h1><p>Os achadinhos que seu pet merece, com os preços que você adora. Acompanhe nossas promoções e faça parte do grupo.</p><div className="hero-actions"><a href={site.whatsappUrl} target="_blank" rel="noopener noreferrer" className="button primary"><MessageCircle size={20} /> Entrar no grupo do WhatsApp <ArrowUpRight size={18} /></a><a href="#promocoes" className="text-link">Ver promoções <ArrowDown size={16} /></a></div><div className="hero-note"><Heart size={16} /> Para quem cuida, ama e gosta de economizar.</div></div><div className="hero-art"><div className="mascot-frame"><Image src="/logo.webp" alt="Mascote da Central Promo Pet: um cachorrinho com olhos de cifrão" width={460} height={460} priority /></div><span className="mascot-badge"><PawPrint size={20} /> Seu pet merece!</span></div></section>
      <div className="benefits"><div className="container benefits-inner"><span><Tag size={20} /> Achadinhos para o dia a dia</span><span><Heart size={20} /> Carinho em cada escolha</span><span><MessageCircle size={20} /> Novidades no WhatsApp</span></div></div>
      <section className="offers-section container" id="promocoes"><div className="section-heading"><div><span className="eyebrow">DE OLHO NAS OFERTAS</span><h2>Promoções de hoje</h2></div><p>Uma boa oportunidade para mimar seu melhor amigo.</p></div><Promotions /><p className="affiliate-note">Alguns links podem gerar uma comissão para a Central Promo Pet, sem custo adicional para você. Preços e disponibilidade são confirmados na loja.</p></section>
      <section className="community container"><div><span className="eyebrow">NOSSO PONTO DE ENCONTRO</span><h2>Os próximos achadinhos<br />chegam no grupo.</h2><p>Entre na comunidade da Central Promo Pet no WhatsApp.</p></div><a href={site.whatsappUrl} target="_blank" rel="noopener noreferrer" className="button light"><MessageCircle size={20} /> Quero fazer parte <ArrowUpRight size={18} /></a></section>
    </main>
    <footer className="container site-footer"><Brand /><span>Carinho pelo seu pet. Cuidado com seu bolso.</span><span>© {new Date().getFullYear()} Central Promo Pet</span></footer>
  </>;
}
