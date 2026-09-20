'use client';

import { FormEvent, useEffect, useState } from 'react';

type AdminUser = {
  id: string;
  email: string;
  displayName: string | null;
  role: 'admin' | 'user';
  status: 'active' | 'inactive';
  passwordExpired: boolean;
  createdAt: string;
};

export function AdminUsers() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [formMode, setFormMode] = useState<'create' | 'edit' | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/admin/users', { cache: 'no-store', signal: controller.signal })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || 'Não foi possível carregar os usuários.');
        setUsers(result.data);
      })
      .catch((cause) => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Não foi possível carregar os usuários.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(''), 3200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const editingUser = editingId ? users.find((user) => user.id === editingId) : null;

  function openCreate() {
    setFormMode('create'); setEditingId(null); setError(''); setNotice('');
  }

  function openEdit(user: AdminUser) {
    setFormMode('edit'); setEditingId(user.id); setError(''); setNotice('');
  }

  function closeForm() {
    setFormMode(null); setEditingId(null); setError('');
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(''); setNotice(''); setSaving(true);
    const form = new FormData(event.currentTarget);
    const isEditing = formMode === 'edit' && editingId;
    const endpoint = isEditing ? `/api/admin/users/${editingId}` : '/api/admin/users';
    const body = isEditing
      ? { email: form.get('email'), displayName: form.get('displayName'), role: form.get('role'), status: form.get('status') }
      : { email: form.get('email'), displayName: form.get('displayName'), temporaryPassword: form.get('temporaryPassword'), role: form.get('role') };
    try {
      const response = await fetch(endpoint, { method: isEditing ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'Não foi possível salvar o usuário.');
      setUsers((current) => isEditing ? current.map((user) => user.id === editingId ? result.data : user) : [result.data, ...current]);
      closeForm();
      setNotice(isEditing ? 'Usuário atualizado com sucesso.' : 'Usuário cadastrado com sucesso.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível salvar o usuário.');
    } finally { setSaving(false); }
  }

  return <div className="admin-users">
    {notice && <div className="toast" role="status">{notice}</div>}
    {formMode && <section className="admin-panel">
      <span className="eyebrow">{formMode === 'edit' ? 'EDITAR USUÁRIO' : 'NOVO USUÁRIO'}</span>
      <h2>{formMode === 'edit' ? 'Atualizar usuário' : 'Cadastrar usuário'}</h2>
      {formMode === 'create' && <p>A senha temporária deve ser compartilhada com a pessoa por um canal seguro. Ela será obrigada a trocá-la no primeiro acesso.</p>}
      <form className="promotion-form" onSubmit={submit} key={editingId || 'new-user'}>
        <label>Nome<input name="displayName" defaultValue={editingUser?.displayName || ''} required maxLength={100} autoComplete="name" /></label>
        <label>E-mail<input name="email" defaultValue={editingUser?.email || ''} type="email" required maxLength={255} autoComplete="email" /></label>
        {formMode === 'create' && <label>Senha temporária<input name="temporaryPassword" type="password" required minLength={12} maxLength={72} autoComplete="new-password" /></label>}
        <label>Perfil<select name="role" defaultValue={editingUser?.role || 'user'}><option value="user">Usuário</option><option value="admin">Administrador</option></select></label>
        {formMode === 'edit' && <label>Status<select name="status" defaultValue={editingUser?.status || 'active'}><option value="active">Ativo</option><option value="inactive">Inativo</option></select></label>}
        {error && <p className="form-error field-wide" role="alert">{error}</p>}
        <div className="field-wide form-actions"><button className="button primary" type="submit" disabled={saving}>{saving ? 'Salvando…' : formMode === 'edit' ? 'Salvar alterações' : 'Cadastrar usuário'}</button><button className="button secondary" type="button" onClick={closeForm}>Cancelar</button></div>
      </form>
    </section>}
    {!formMode && <section className="admin-list">
      <div className="section-heading"><div><span className="eyebrow">ACESSOS</span><h2>Usuários cadastrados</h2></div><button className="button primary" type="button" onClick={openCreate}>Novo usuário</button></div>
      {loading ? <p role="status">Carregando usuários…</p> : users.length === 0 ? <p className="empty-state">Nenhum usuário cadastrado.</p> : <div className="admin-offer-list">
        {users.map((user) => <article className="admin-offer" key={user.id}>
          <div><span className="status-pill">{user.role === 'admin' ? 'Administrador' : 'Usuário'}</span><span className={`status-pill ${user.status === 'active' ? 'verified' : 'draft'}`}>{user.status === 'active' ? 'Ativo' : 'Inativo'}</span></div>
          <h3>{user.displayName || user.email}</h3><p>{user.email}</p>
          {user.passwordExpired && <small>Senha temporária aguardando troca no primeiro acesso</small>}
          <small>Cadastrado em {new Date(user.createdAt).toLocaleDateString('pt-BR')}</small>
          <div className="admin-offer-actions"><button className="button secondary" type="button" onClick={() => openEdit(user)}>Editar usuário</button></div>
        </article>)}
      </div>}
    </section>}
  </div>;
}
