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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editRole, setEditRole] = useState<'admin' | 'user'>('user');
  const [editStatus, setEditStatus] = useState<'active' | 'inactive'>('active');

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

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(''); setNotice(''); setSaving(true);
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.get('email'), displayName: form.get('displayName'), temporaryPassword: form.get('temporaryPassword'), role: form.get('role') }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'Não foi possível cadastrar o usuário.');
      setUsers((current) => [result.data, ...current]);
      formElement.reset();
      setNotice('Usuário cadastrado. Ele precisará trocar a senha temporária no primeiro acesso.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível cadastrar o usuário.');
    } finally { setSaving(false); }
  }

  function startEditing(user: AdminUser) {
    setEditingId(user.id); setEditName(user.displayName || ''); setEditEmail(user.email); setEditRole(user.role); setEditStatus(user.status); setError(''); setNotice('');
  }
  async function saveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingId) return;
    setError(''); setNotice(''); setSaving(true);
    try {
      const response = await fetch(`/api/admin/users/${editingId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: editEmail, displayName: editName, role: editRole, status: editStatus }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'Não foi possível atualizar o usuário.');
      setUsers((current) => current.map((user) => user.id === editingId ? result.data : user));
      setEditingId(null); setNotice('Usuário atualizado com sucesso.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível atualizar o usuário.'); }
    finally { setSaving(false); }
  }

  return <div className="admin-users">
    <section className="admin-panel">
      <span className="eyebrow">NOVO USUÁRIO</span>
      <h2>Cadastrar usuário</h2>
      <p>A senha temporária deve ser compartilhada com a pessoa por um canal seguro. Ela será obrigada a trocá-la no primeiro acesso.</p>
      <form className="promotion-form" onSubmit={submit}>
        <label>Nome<input name="displayName" required maxLength={100} autoComplete="name" /></label>
        <label>E-mail<input name="email" type="email" required maxLength={255} autoComplete="email" /></label>
        <label>Senha temporária<input name="temporaryPassword" type="password" required minLength={12} maxLength={72} autoComplete="new-password" /></label>
        <label>Perfil<select name="role" defaultValue="user"><option value="user">Usuário</option><option value="admin">Administrador</option></select></label>
        {error && <p className="form-error field-wide" role="alert">{error}</p>}
        {notice && <p className="form-success field-wide" role="status">{notice}</p>}
        <div className="field-wide"><button className="button primary" type="submit" disabled={saving}>{saving ? 'Cadastrando…' : 'Cadastrar usuário'}</button></div>
      </form>
    </section>
    <section className="admin-list">
      <div className="section-heading"><div><span className="eyebrow">ACESSOS</span><h2>Usuários cadastrados</h2></div></div>
      {loading ? <p role="status">Carregando usuários…</p> : users.length === 0 ? <p className="empty-state">Nenhum usuário cadastrado.</p> : <div className="admin-offer-list">
        {users.map((user) => <article className="admin-offer" key={user.id}>
          {editingId === user.id ? <form className="admin-user-edit" onSubmit={saveEdit}>
            <label>Nome<input value={editName} onChange={(event) => setEditName(event.target.value)} maxLength={100} required /></label>
            <label>E-mail<input value={editEmail} onChange={(event) => setEditEmail(event.target.value)} type="email" maxLength={255} required /></label>
            <label>Perfil<select value={editRole} onChange={(event) => setEditRole(event.target.value as 'admin' | 'user')}><option value="user">Usuário</option><option value="admin">Administrador</option></select></label>
            <label>Status<select value={editStatus} onChange={(event) => setEditStatus(event.target.value as 'active' | 'inactive')}><option value="active">Ativo</option><option value="inactive">Inativo</option></select></label>
            <div className="admin-offer-actions"><button className="button primary" type="submit" disabled={saving}>{saving ? 'Salvando…' : 'Salvar alterações'}</button><button className="button secondary" type="button" onClick={() => setEditingId(null)}>Cancelar</button></div>
          </form> : <>
          <div><span className="status-pill">{user.role === 'admin' ? 'Administrador' : 'Usuário'}</span><span className={`status-pill ${user.status === 'active' ? 'verified' : 'draft'}`}>{user.status === 'active' ? 'Ativo' : 'Inativo'}</span></div>
          <h3>{user.displayName || user.email}</h3>
          <p>{user.email}</p>
          {user.passwordExpired && <small>Senha temporária aguardando troca no primeiro acesso</small>}
          <small>Cadastrado em {new Date(user.createdAt).toLocaleDateString('pt-BR')}</small>
          <div className="admin-offer-actions"><button className="button secondary" type="button" onClick={() => startEditing(user)}>Editar usuário</button></div>
          </>}
        </article>)}
      </div>}
    </section>
  </div>;
}
