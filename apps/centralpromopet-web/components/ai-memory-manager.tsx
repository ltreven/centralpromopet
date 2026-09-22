'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
type MemoryData = { pets: { id: string; name: string }[]; memories: { id: string; petId: string; content: string; category: string; sourceQuote: string; createdAt: string }[]; threads: { id: string; title: string; summary: string }[] };
export function AiMemoryManager() {
  const [data, setData] = useState<MemoryData | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/chat/memory', { cache: 'no-store', signal: controller.signal }).then(async (r) => {
      const body = await r.json(); if (!r.ok) throw new Error(body.message); setData(body.data);
    }).catch((e) => { if (!controller.signal.aborted) setError(e.message); });
    return () => controller.abort();
  }, []);
  async function remove(path: string, question: string) {
    if (!window.confirm(question)) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const r = await fetch(`/api/chat/${path}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      const body = await r.json(); if (!r.ok) throw new Error(body.message);
      const response = await fetch('/api/chat/memory', { cache: 'no-store' });
      const result = await response.json(); if (!response.ok) throw new Error(result.message);
      setData(result.data); setNotice('Informações apagadas com sucesso.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível apagar.'); }
    finally { setBusy(false); }
  }
  return <div className="ai-settings">
    {error && <p className="form-error" role="alert">{error}</p>}{notice && <p className="form-success" role="status">{notice}</p>}
    {!data ? <p role="status">Carregando suas informações…</p> : <>
      <section className="admin-panel"><h2>Meus pets</h2><p>{data.pets.length ? data.pets.map((p) => p.name).join(', ') : 'Você ainda não cadastrou um pet.'}</p><Link className="button secondary" href="/dashboard/pets">Gerenciar pets</Link></section>
      <section className="admin-list"><h2>O que vou lembrar</h2><p>Preferências vêm do que você contou. Informações de saúde são relatos do tutor, não diagnósticos.</p><div className="admin-offer-list">{data.memories.map((memory) => <article className="admin-offer" key={memory.id}><strong>{data.pets.find((p) => p.id === memory.petId)?.name || 'Pet'}</strong><p>{memory.content}</p><small>Você contou: “{memory.sourceQuote}” — {new Date(memory.createdAt).toLocaleDateString('pt-BR')}</small><div><button className="button danger" disabled={busy} onClick={() => remove(`memory/${memory.id}`, 'Apagar esta memória? As mensagens e os resumos das conversas também serão limpos para que a informação não seja lembrada novamente. As demais memórias e os pets serão mantidos.')}>Esquecer</button></div></article>)}{!data.memories.length && <p className="empty-state">Nenhuma memória guardada por enquanto.</p>}</div></section>
      <section className="admin-list"><h2>Conversas e resumos</h2><div className="admin-offer-list">{data.threads.map((thread) => <article className="admin-offer" key={thread.id}><h3>{thread.title}</h3><p>{thread.summary || 'Sem resumo por enquanto.'}</p><div className="form-actions"><Link className="button secondary" href={`/chat?thread=${thread.id}`}>Continuar conversa</Link><button className="button danger" disabled={busy} onClick={() => remove(`threads/${thread.id}`, 'Apagar esta conversa e seu resumo? As memórias salvas separadamente continuam disponíveis acima.')}>Apagar conversa</button></div></article>)}{!data.threads.length && <p className="empty-state">Nenhuma conversa salva.</p>}</div></section>
      <section className="admin-panel"><h2>Recomeçar</h2><p>Apaga memórias, conversas e resumos. Seu cadastro de pets e suas preferências de newsletter permanecem.</p><button className="button danger" disabled={busy} onClick={() => remove('memory', 'Apagar todas as memórias e conversas? Esta ação não pode ser desfeita.')}>Apagar todas as memórias e conversas</button></section>
    </>}
  </div>;
}
