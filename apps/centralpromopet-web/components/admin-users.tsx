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
          <div><span className="status-pill">{user.role === 'admin' ? 'Administrador' : 'Usuário'}</span><span className={`status-pill ${user.status === 'active' ? 'verified' : 'draft'}`}>{user.status === 'active' ? 'Ativo' : 'Inativo'}</span></div>
          <h3>{user.displayName || user.email}</h3>
          <p>{user.email}</p>
          {user.passwordExpired && <small>Senha temporária aguardando troca no primeiro acesso</small>}
          <small>Cadastrado em {new Date(user.createdAt).toLocaleDateString('pt-BR')}</small>
        </article>)}
      </div>}
    </section>
  </div>;
}
