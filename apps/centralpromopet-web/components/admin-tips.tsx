'use client';

import { FormEvent, useEffect, useState } from 'react';

type TipCategory = 'wellness' | 'training';
type Tip = { id: string; title: string; content: string; category: TipCategory; createdAt: string };
const categoryLabels: Record<TipCategory, string> = { wellness: 'Bem-estar', training: 'Treinamento' };

export function AdminTips() {
  const [tips, setTips] = useState<Tip[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Tip | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function loadTips() {
    setLoading(true);
    try {
      const response = await fetch('/api/tips/admin', { cache: 'no-store' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'Não foi possível carregar as dicas.');
      setTips(result.data);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível carregar as dicas.'); }
    finally { setLoading(false); }
  }
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/tips/admin', { cache: 'no-store', signal: controller.signal })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || 'Não foi possível carregar as dicas.');
        setTips(result.data);
      })
      .catch((cause) => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Não foi possível carregar as dicas.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(''), 3200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError('');
    const form = new FormData(event.currentTarget);
    const body = { title: form.get('title'), content: form.get('content'), category: form.get('category') };
    try {
      const response = await fetch(editing ? `/api/tips/${editing.id}` : '/api/tips', { method: editing ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'Não foi possível salvar a dica.');
      setCreating(false); setEditing(null); setNotice(editing ? 'Dica atualizada com sucesso.' : 'Dica cadastrada com sucesso.'); await loadTips();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível salvar a dica.'); }
    finally { setSaving(false); }
  }
  async function removeTip(tip: Tip) {
    if (!window.confirm(`Excluir a dica “${tip.title}”?`)) return;
    setDeleting(tip.id); setError('');
    try {
      const response = await fetch(`/api/tips/${tip.id}`, { method: 'DELETE' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'Não foi possível excluir a dica.');
      setNotice('Dica excluída com sucesso.'); await loadTips();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível excluir a dica.'); }
    finally { setDeleting(null); }
  }

  return <div className="admin-tips">
    {notice && <div className="toast" role="status">{notice}</div>}
    {(creating || editing) && <section className="admin-panel">
      <span className="eyebrow">{editing ? 'EDITAR DICA' : 'NOVA DICA'}</span><h2>{editing ? 'Editar dica' : 'Cadastrar dica'}</h2><p>Publique conteúdos curtos e úteis para o bem-estar e treinamento dos pets.</p>
      <form className="tip-admin-form" onSubmit={submit}>
        <label>Título<input name="title" required maxLength={200} defaultValue={editing?.title || ''} placeholder="Ex.: Brincar também é cuidar" /></label>
        <label>Categoria<select name="category" defaultValue={editing?.category || 'wellness'}><option value="wellness">Bem-estar</option><option value="training">Treinamento</option></select></label>
        <label className="field-wide">Conteúdo<textarea name="content" required maxLength={2000} rows={5} defaultValue={editing?.content || ''} placeholder="Escreva a dica em linguagem simples e acolhedora." /></label>
        {error && <p className="form-error field-wide" role="alert">{error}</p>}
        <div className="field-wide form-actions"><button className="button primary" type="submit" disabled={saving}>{saving ? 'Salvando…' : editing ? 'Salvar alterações' : 'Cadastrar dica'}</button><button className="button secondary" type="button" onClick={() => { setCreating(false); setEditing(null); setError(''); }}>Cancelar</button></div>
      </form>
    </section>}
    {!(creating || editing) && <section className="admin-list">
      <div className="section-heading"><div><span className="eyebrow">CONTEÚDO</span><h2>Dicas cadastradas</h2></div><button className="button primary" type="button" onClick={() => { setCreating(true); setError(''); }}>Nova dica</button></div>
      {loading ? <p role="status">Carregando dicas…</p> : tips.length === 0 ? <p className="empty-state">Nenhuma dica cadastrada.</p> : <div className="admin-offer-list">{tips.map((tip) => <article className="admin-offer" key={tip.id}><div><span className="status-pill">{categoryLabels[tip.category]}</span></div><h3>{tip.title}</h3><p>{tip.content}</p><small>Cadastrada em {new Date(tip.createdAt).toLocaleDateString('pt-BR')}</small><div className="admin-offer-actions"><button className="button secondary" type="button" onClick={() => { setEditing(tip); setError(''); }}>Editar</button><button className="button danger" type="button" disabled={deleting === tip.id} onClick={() => removeTip(tip)}>{deleting === tip.id ? 'Excluindo…' : 'Excluir'}</button></div></article>)}</div>}
    </section>}
  </div>;
}
