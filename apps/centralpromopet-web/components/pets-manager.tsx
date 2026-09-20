'use client';

import { FormEvent, useEffect, useState } from 'react';
import { PawPrint, Pencil, Plus, Trash2, X } from 'lucide-react';
import { approximateAge, Pet, PetType, petTypeIcons, petTypeLabels } from '@/lib/pets';

const types: PetType[] = ['dogs', 'cats', 'other'];
const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const currentYear = new Date().getFullYear();

export function PetsManager() {
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

  useEffect(() => {
    fetch('/api/pets', { cache: 'no-store' }).then(async (response) => {
      if (!response.ok) throw new Error('Não foi possível carregar seus pets.');
      setPets((await response.json()).data);
      setStatus('ready');
    }).catch((error) => { setMessage(error.message); setStatus('ready'); });
  }, []);
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
  async function removePet(pet: Pet) {
    if (!window.confirm(`Remover ${pet.name} da sua lista?`)) return;
    const response = await fetch(`/api/pets/${pet.id}`, { method: 'DELETE' });
    if (!response.ok) { setMessage('Não foi possível remover o pet.'); return; }
    setPets((current) => current.filter((item) => item.id !== pet.id));
    if (editingId === pet.id) resetForm();
    setNotice('Pet removido com sucesso.');
  }
  if (status === 'loading') return <section className="pets-page"><div className="empty-state" role="status">Carregando seus pets…</div></section>;
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
      {!creating && <div className="pets-list"><div className="section-heading"><div><span className="eyebrow">SEUS COMPANHEIROS</span><h2>{pets.length ? `${pets.length} pet${pets.length === 1 ? '' : 's'} cadastrado${pets.length === 1 ? '' : 's'}` : 'Ainda não há pets'}</h2></div></div>
        {pets.length ? pets.map((pet) => <article className="pet-card" key={pet.id}><span className="pet-card-icon" aria-hidden="true">{petTypeIcons[pet.type]}</span><div><h3>{pet.name}</h3><p>{[petTypeLabels[pet.type], pet.breed, approximateAge(pet) ? `aprox. ${approximateAge(pet)}` : null].filter(Boolean).join(' · ')}</p></div><div className="pet-card-actions"><button type="button" aria-label={`Editar ${pet.name}`} onClick={() => editPet(pet)}><Pencil size={17} /></button><button type="button" aria-label={`Remover ${pet.name}`} onClick={() => removePet(pet)}><Trash2 size={17} /></button></div></article>) : <div className="empty-state"><span className="icon-bubble"><PawPrint size={26} /></span><h3>Comece pelo primeiro pet</h3><p>Depois de cadastrar, a home vai destacar promoções para ele automaticamente.</p></div>}
      </div>}
    </div>
  </section>;
}
