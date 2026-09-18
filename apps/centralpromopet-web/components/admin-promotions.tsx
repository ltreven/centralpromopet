'use client';

import { FormEvent, useEffect, useState } from 'react';

type PetType = 'dogs' | 'cats' | 'birds' | 'other';
type Promotion = {
  id: string;
  title: string;
  store: string;
  currency: string;
  imageUrl: string | null;
  coupon: string | null;
  storeVerified: boolean;
  petTypes: PetType[];
  priceCents: number;
  originalPriceCents: number | null;
  status: 'draft' | 'published';
  endsAt: string;
};

const petLabels: Record<PetType, string> = { dogs: 'Cães', cats: 'Gatos', birds: 'Pássaros', other: 'Outros' };
const money = (cents: number, currency = 'BRL') => new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(cents / 100);
function defaultEndDate() {
  const date = new Date();
  date.setDate(date.getDate() + 30);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function AdminPromotions() {
  const [offers, setOffers] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function loadOffers() {
    setLoading(true);
    try {
      const response = await fetch('/api/promotions/admin', { cache: 'no-store' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'Não foi possível carregar as promoções.');
      setOffers(result.data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível carregar as promoções.');
    } finally { setLoading(false); }
  }

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/promotions/admin', { cache: 'no-store', signal: controller.signal })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || 'Não foi possível carregar as promoções.');
        setOffers(result.data);
      })
      .catch((cause) => {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Não foi possível carregar as promoções.');
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setNotice(''); setSaving(true);
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const date = String(form.get('endsAt'));
    const body = {
      title: form.get('title'), store: form.get('store'), currency: form.get('currency'), coupon: form.get('coupon'), imageUrl: form.get('imageUrl'),
      storeVerified: form.get('storeVerified') === 'on',
      petTypes: form.getAll('petTypes'),
      originalPrice: form.get('originalPrice'), promotionalPrice: form.get('promotionalPrice'),
      affiliateUrl: form.get('affiliateUrl'),
      endsAt: new Date(`${date}T23:59:59.999-03:00`).toISOString(),
      status: form.get('status'),
    };
    try {
      const response = await fetch('/api/promotions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'Não foi possível salvar a promoção.');
      formElement.reset();
      setNotice('Promoção cadastrada com sucesso.');
      await loadOffers();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível salvar a promoção.');
    } finally { setSaving(false); }
  }

  return <div className="admin-promotions">
    <section className="admin-panel">
      <span className="eyebrow">NOVA OFERTA</span>
      <h2>Cadastrar produto ou promoção</h2>
      <p>Informe os dados do produto e escolha para quais pets ele é indicado.</p>
      <form className="promotion-form" onSubmit={submit}>
        <label className="field-wide">Nome do produto<input name="title" required maxLength={200} defaultValue="Coleira Plaquinha Nome Telefone Gato Cachorro Identificação Aço Inox" /></label>
        <label>Marketplace ou loja<input name="store" required maxLength={100} defaultValue="Mercado Livre" /></label>
        <label>Cupom (opcional)<input name="coupon" maxLength={100} defaultValue="BATEUPRONTOCUPOM" /></label>
        <label>Preço original (R$, opcional)<input name="originalPrice" type="number" min="0.01" step="0.01" defaultValue="38.90" /></label>
        <label>Preço promocional (R$)<input name="promotionalPrice" type="number" min="0.01" step="0.01" required defaultValue="27.22" /></label>
        <label className="field-wide">Link da oferta<input name="affiliateUrl" type="url" required defaultValue="https://meli.la/2Je3kJq" /></label>
        <label>Imagem (URL ou caminho em /promotions/)<input name="imageUrl" maxLength={2048} placeholder="/promotions/nome-do-produto.jpg" /></label>
        <label>Moeda<select name="currency" defaultValue="BRL"><option value="BRL">BRL — Real</option></select></label>
        <fieldset className="pet-options field-wide">
          <legend>Indicado para</legend>
          {(Object.entries(petLabels) as [PetType, string][]).map(([value, label]) => <label className="choice" key={value}>
            <input type="checkbox" name="petTypes" value={value} defaultChecked={value === 'dogs' || value === 'cats'} />{label}
          </label>)}
        </fieldset>
        <label className="choice field-wide"><input type="checkbox" name="storeVerified" defaultChecked />Loja verificada</label>
        <label>Válida até<input name="endsAt" type="date" min={new Date().toLocaleDateString('en-CA')} defaultValue={defaultEndDate()} required /></label>
        <label>Status<select name="status" defaultValue="draft"><option value="draft">Rascunho</option><option value="published">Publicada</option></select></label>
        {error && <p className="form-error field-wide" role="alert">{error}</p>}
        {notice && <p className="form-success field-wide" role="status">{notice}</p>}
        <div className="field-wide"><button className="button primary" type="submit" disabled={saving}>{saving ? 'Salvando…' : 'Cadastrar promoção'}</button></div>
      </form>
    </section>

    <section className="admin-list">
      <div className="section-heading"><div><span className="eyebrow">CATÁLOGO</span><h2>Produtos e promoções</h2></div></div>
      {loading ? <p role="status">Carregando promoções…</p> : offers.length === 0 ? <p className="empty-state">Nenhuma promoção cadastrada.</p> : <div className="admin-offer-list">
        {offers.map((offer) => <article className="admin-offer" key={offer.id}>
          <div><span className={`status-pill ${offer.status}`}>{offer.status === 'published' ? 'Publicada' : 'Rascunho'}</span>{offer.storeVerified && <span className="status-pill verified">Loja verificada</span>}</div>
          <h3>{offer.title}</h3>
          <p>{offer.store}{offer.coupon ? ` · Cupom ${offer.coupon}` : ''}</p>
          <div className="pet-tags">{offer.petTypes.map((pet) => <span key={pet}>{petLabels[pet]}</span>)}</div>
          <div className="price">{offer.originalPriceCents && <del>{money(offer.originalPriceCents, offer.currency)}</del>}<strong>{money(offer.priceCents, offer.currency)}</strong></div>
          <small>Válida até {new Date(offer.endsAt).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</small>
        </article>)}
      </div>}
    </section>
  </div>;
}
