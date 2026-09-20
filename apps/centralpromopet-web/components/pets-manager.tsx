'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, CheckCircle2, PawPrint, Pencil, Plus, Trash2, X } from 'lucide-react';
import { approximateAge, Pet, PetType, petTypeIcons, petTypeLabels } from '@/lib/pets';

const types: PetType[] = ['dogs', 'cats', 'other'];
const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const currentYear = new Date().getFullYear();

function petNames(pets: Pet[]) {
  const names = pets.map((pet) => pet.name);
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} e ${names[1]}`;
  return `${names.slice(0, -1).join(', ')} e ${names.at(-1)}`;
}

export function PetsManager({ dailyTipsFlow = false }: { dailyTipsFlow?: boolean }) {
  const [pets, setPets] = useState<Pet[]>([]);
  const [name, setName] = useState('');
  const [type, setType] = useState<PetType>('dogs');
  const [breed, setBreed] = useState('');
  const [birthMonth, setBirthMonth] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [receiveUpdates, setReceiveUpdates] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [status, setStatus] = useState<'loading' | 'ready' | 'saving'>('loading');
  const [message, setMessage] = useState('');
  const [notice, setNotice] = useState('');
  const [dailyTipsSubscribed, setDailyTipsSubscribed] = useState(!dailyTipsFlow);
  const [flowStep, setFlowStep] = useState<'choose-type' | 'choose-name' | 'birth' | 'complete'>('choose-type');
  const [flowType, setFlowType] = useState<'dogs' | 'cats' | null>(null);
  const [flowName, setFlowName] = useState('');
  const [flowPet, setFlowPet] = useState<Pet | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const response = await fetch('/api/pets', { cache: 'no-store' });
        if (!response.ok) throw new Error('Não foi possível carregar seus pets.');
        const data = (await response.json()).data as Pet[];
        if (!active) return;
        setPets(data);
        if (dailyTipsFlow) {
          const preferenceResponse = await fetch('/api/identity/preferences', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ receiveNewsletter: true }) });
          if (!preferenceResponse.ok) throw new Error('Não foi possível ativar o recebimento das dicas agora. Tente novamente em alguns instantes.');
          if (!active) return;
          setDailyTipsSubscribed(true);
        }
      } catch (error) {
        if (active) setMessage(error instanceof Error ? error.message : 'Não foi possível preparar esta página.');
      } finally {
        if (active) setStatus('ready');
      }
    }
    load();
    return () => { active = false; };
  }, [dailyTipsFlow]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(''), 3200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  function resetForm() { setName(''); setType('dogs'); setBreed(''); setBirthMonth(''); setBirthYear(''); setReceiveUpdates(false); setEditingId(null); setCreating(false); setMessage(''); }
  function editPet(pet: Pet) { setCreating(true); setEditingId(pet.id); setName(pet.name); setType(pet.type); setBreed(pet.breed || ''); setBirthMonth(pet.birthMonth ? String(pet.birthMonth) : ''); setBirthYear(pet.birthYear ? String(pet.birthYear) : ''); setReceiveUpdates(pet.receiveUpdates); setMessage(''); window.scrollTo({ top: 0, behavior: 'smooth' }); }

  async function submit(event: FormEvent) {
    event.preventDefault(); setStatus('saving'); setMessage('');
    const response = await fetch(editingId ? `/api/pets/${editingId}` : '/api/pets', { method: editingId ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, type, breed: breed.trim() || null, birthMonth: birthMonth ? Number(birthMonth) : null, birthYear: birthYear ? Number(birthYear) : null, receiveUpdates }) });
    const result = await response.json();
    if (!response.ok) { setMessage(result.message || 'Não foi possível salvar o pet.'); setStatus('ready'); return; }
    setPets((current) => editingId ? current.map((pet) => pet.id === editingId ? result.data : pet) : [...current, result.data]);
    resetForm(); setStatus('ready'); setNotice(editingId ? 'Pet atualizado com sucesso.' : 'Pet cadastrado com sucesso.');
  }

  async function saveFlowName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!flowType || !flowName.trim()) return;
    setStatus('saving'); setMessage('');
    try {
      const response = await fetch('/api/pets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: flowName.trim(), type: flowType, breed: null, birthMonth: null, birthYear: null, receiveUpdates: true }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'Não foi possível cadastrar o pet.');
      setPets((current) => [...current, result.data]);
      setFlowPet(result.data); setFlowStep('birth');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível cadastrar o pet.');
    } finally { setStatus('ready'); }
  }

  async function saveFlowBirth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!flowPet || !birthMonth || !birthYear) return;
    setStatus('saving'); setMessage('');
    try {
      const response = await fetch(`/api/pets/${flowPet.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: flowPet.name, type: flowPet.type, breed: flowPet.breed, birthMonth: Number(birthMonth), birthYear: Number(birthYear), receiveUpdates: true }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'Não foi possível salvar a data de nascimento.');
      setPets((current) => current.map((pet) => pet.id === flowPet.id ? result.data : pet));
      setFlowPet(result.data); setFlowStep('complete');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível salvar a data de nascimento.');
    } finally { setStatus('ready'); }
  }

  async function removePet(pet: Pet) {
    if (!window.confirm(`Remover ${pet.name} da sua lista?`)) return;
    const response = await fetch(`/api/pets/${pet.id}`, { method: 'DELETE' });
    if (!response.ok) { setMessage('Não foi possível remover o pet.'); return; }
    setPets((current) => current.filter((item) => item.id !== pet.id));
    if (editingId === pet.id) resetForm();
    setNotice('Pet removido com sucesso.');
  }

  if (status === 'loading') return <section className="pets-page"><div className="empty-state" role="status">Preparando suas dicas e novidades…</div></section>;

  if (dailyTipsFlow && !dailyTipsSubscribed) return <section className="pets-page daily-tips-page"><section className="daily-tips-flow admin-panel"><span className="eyebrow">QUASE LÁ</span><h1>Não conseguimos ativar as dicas agora.</h1><p className="form-error" role="alert">{message || 'Tente novamente em alguns instantes.'}</p><Link className="button secondary" href="/dashboard/pets">Voltar para Meu Pet</Link></section></section>;

  if (dailyTipsFlow && flowPet) return <section className="pets-page daily-tips-page"><section className="daily-tips-flow admin-panel">
    {flowStep === 'birth' ? <><span className="eyebrow">{flowPet.name.toUpperCase()} JÁ ESTÁ CADASTRADO</span><h1>Agora só falta uma coisinha.</h1><p>Você já receberá dicas de bem-estar, treinamento e novidades. Se souber, conte o mês e o ano de nascimento de {flowPet.name}; assim estimamos a idade dele direitinho.</p><form className="daily-tips-form" onSubmit={saveFlowBirth}><div className="birth-fields"><div><select aria-label="Mês de nascimento" value={birthMonth} onChange={(event) => setBirthMonth(event.target.value)} required><option value="">Mês</option>{months.map((month, index) => <option key={month} value={index + 1}>{month}</option>)}</select><input aria-label="Ano de nascimento" type="number" min="1900" max={currentYear} placeholder="Ano" value={birthYear} onChange={(event) => setBirthYear(event.target.value)} required /></div></div>{message && <p className="form-error" role="alert">{message}</p>}<div className="form-actions"><button className="button primary" type="submit" disabled={status === 'saving'}>{status === 'saving' ? 'Salvando…' : 'Salvar data aproximada'}</button><button className="button secondary" type="button" onClick={() => setFlowStep('complete')}>Pular por enquanto</button></div></form></> : <><span className="eyebrow">TUDO CERTO</span><CheckCircle2 className="daily-tips-success-icon" size={42} aria-hidden="true" /><h1>{flowPet.name} já faz parte da Central.</h1><p>As dicas diárias de bem-estar e treinamento, além das novidades, já estão ativadas para você.</p><div className="form-actions"><Link className="button primary" href="/dashboard/pets">Ver meu pet <ArrowUpRight size={17} /></Link><Link className="button secondary" href="/">Ver promoções</Link></div></>}
  </section></section>;

  if (dailyTipsFlow && pets.length) return <section className="pets-page daily-tips-page"><section className="daily-tips-confirmation admin-panel"><CheckCircle2 size={42} aria-hidden="true" /><div><span className="eyebrow">DICAS ATIVADAS</span><h1>Que alegria ter {petNames(pets)} por aqui!</h1><p>A partir de agora, você receberá dicas diárias de bem-estar e treinamento, além de novidades pensadas para {pets.length === 1 ? 'seu companheiro' : 'seus companheiros'}.</p><Link className="button primary" href="/dashboard/pets">Gerenciar meus pets <ArrowUpRight size={17} /></Link></div></section></section>;

  if (dailyTipsFlow) return <section className="pets-page daily-tips-page"><section className="daily-tips-flow admin-panel">
    {flowStep === 'choose-type' && <><span className="eyebrow">DICAS ATIVADAS</span><h1>Que bom ter você com a gente!</h1><p>Você já receberá dicas diárias de bem-estar e treinamento, além de novidades da Central. Para deixá-las ainda mais úteis, me conta: elas são para qual companheiro?</p><div className="daily-tips-choices"><button className="daily-tips-choice" type="button" onClick={() => { setFlowType('dogs'); setFlowStep('choose-name'); }}>🐶 <span>Para cães</span></button><button className="daily-tips-choice" type="button" onClick={() => { setFlowType('cats'); setFlowStep('choose-name'); }}>🐱 <span>Para gatos</span></button></div></>}
    {flowStep === 'choose-name' && <><span className="eyebrow">SÓ MAIS UM DETALHE</span><h1>Como se chama seu {flowType === 'dogs' ? 'cãozinho' : 'gatinho'}?</h1><p>Assim já deixamos o cadastro dele pronto e podemos personalizar os próximos garimpos.</p><form className="daily-tips-form" onSubmit={saveFlowName}><label>Nome<input value={flowName} onChange={(event) => setFlowName(event.target.value)} maxLength={80} placeholder={flowType === 'dogs' ? 'Ex.: Thor' : 'Ex.: Luna'} autoFocus required /></label>{message && <p className="form-error" role="alert">{message}</p>}<div className="form-actions"><button className="button primary" type="submit" disabled={status === 'saving'}>{status === 'saving' ? 'Cadastrando…' : 'Continuar'}</button><button className="button secondary" type="button" onClick={() => setFlowStep('choose-type')}>Voltar</button></div></form></>}
  </section></section>;

  return <section className="pets-page">
    {notice && <div className="toast" role="status">{notice}</div>}
    <div className="pets-page-heading"><div><span className="eyebrow">MINHA CONTA</span><h1>Meu Pet</h1><p>Cadastre seus companheiros para personalizar os garimpos da Central.</p></div><button className="button primary" type="button" onClick={() => { resetForm(); setCreating(true); }}>Novo pet</button></div>
    <div className={creating ? 'pets-layout pets-layout-form-only' : 'pets-layout pets-layout-list-only'}>
      {creating && <form className="admin-panel pet-form" onSubmit={submit}>
        <span className="eyebrow">{editingId ? 'EDITAR PET' : 'NOVO PET'}</span><h2>{editingId ? 'Atualize os dados' : 'Quem mora no seu coração?'}</h2>
        <label>Nome<input value={name} onChange={(event) => setName(event.target.value)} maxLength={80} placeholder="Ex.: Thor" required /></label>
        <label>Tipo<select value={type} onChange={(event) => setType(event.target.value as PetType)}>{types.map((item) => <option key={item} value={item}>{petTypeIcons[item]} {petTypeLabels[item]}</option>)}</select></label>
        <label>Raça <span className="field-hint">opcional</span><input value={breed} onChange={(event) => setBreed(event.target.value)} maxLength={100} placeholder="Ex.: Golden Retriever ou SRD" /></label>
        <fieldset className="birth-fields"><legend>Nascimento aproximado <span className="field-hint">opcional</span></legend><p className="field-help">Não precisa saber o dia: mês e ano já são suficientes para estimarmos a idade.</p><div><select aria-label="Mês de nascimento" value={birthMonth} onChange={(event) => setBirthMonth(event.target.value)}><option value="">Mês</option>{months.map((month, index) => <option key={month} value={index + 1}>{month}</option>)}</select><input aria-label="Ano de nascimento" type="number" min="1900" max={currentYear} placeholder="Ano" value={birthYear} onChange={(event) => setBirthYear(event.target.value)} /></div></fieldset>
        <label className="checkbox-field"><input type="checkbox" checked={receiveUpdates} onChange={(event) => setReceiveUpdates(event.target.checked)} /><span>Quero receber uma dica de bem-estar e treinamento por dia para este pet.</span></label>
        {message && <p className="form-error" role="alert">{message}</p>}
        <div className="form-actions"><button className="button primary" disabled={status === 'saving'} type="submit">{editingId ? <Pencil size={17} /> : <Plus size={17} />}{status === 'saving' ? 'Salvando…' : editingId ? 'Salvar alterações' : 'Cadastrar pet'}</button>{editingId && <button className="button secondary" type="button" onClick={resetForm}><X size={17} /> Cancelar</button>}</div>
      </form>}
      {!creating && <PetsList pets={pets} onEdit={editPet} onRemove={removePet} />}
    </div>
  </section>;
}

function PetsList({ pets, onEdit, onRemove }: { pets: Pet[]; onEdit: (pet: Pet) => void; onRemove: (pet: Pet) => void }) {
  return <div className="pets-list"><div className="section-heading"><div><span className="eyebrow">SEUS COMPANHEIROS</span><h2>{pets.length ? `${pets.length} pet${pets.length === 1 ? '' : 's'} cadastrado${pets.length === 1 ? '' : 's'}` : 'Ainda não há pets'}</h2></div></div>
    {pets.length ? pets.map((pet) => <article className="pet-card" key={pet.id}><span className="pet-card-icon" aria-hidden="true">{petTypeIcons[pet.type]}</span><div><h3>{pet.name}</h3><p>{[petTypeLabels[pet.type], pet.breed, approximateAge(pet) ? `aprox. ${approximateAge(pet)}` : null].filter(Boolean).join(' · ')}</p></div><div className="pet-card-actions"><button type="button" aria-label={`Editar ${pet.name}`} onClick={() => onEdit(pet)}><Pencil size={17} /></button><button type="button" aria-label={`Remover ${pet.name}`} onClick={() => onRemove(pet)}><Trash2 size={17} /></button></div></article>) : <div className="empty-state"><span className="icon-bubble"><PawPrint size={26} /></span><h3>Comece pelo primeiro pet</h3><p>Depois de cadastrar, a home vai destacar promoções para ele automaticamente.</p></div>}
  </div>;
}
