'use client';

import { useEffect, useMemo, useState } from 'react';
import { Activity, Bot, Cat, MessageCircle, PawPrint, Users } from 'lucide-react';

type DashboardData = {
  activeWindowDays: number;
  stats: {
    totalUsers: number;
    activeUsers: number;
    totalPets: number;
    usersWithPets: number;
    chatMessages: number;
    chatThreads: number;
  };
  recentActivity: {
    id: string;
    event: string;
    entityType: string | null;
    entityId: string | null;
    details: Record<string, unknown>;
    createdAt: string;
    userEmail: string | null;
    userName: string | null;
  }[];
};

const eventLabels: Record<string, string> = {
  'user.login': 'Login',
  'user.preferences.update': 'Preferências atualizadas',
  'user.password.change': 'Senha alterada',
  'user.google.link': 'Google vinculado',
  'pet.create': 'Pet cadastrado',
  'pet.update': 'Pet atualizado',
  'pet.delete': 'Pet removido',
  'chat.message': 'Mensagem para IA',
  'chat.action.approve': 'Ação da IA aprovada',
  'chat.action.reject': 'Ação da IA recusada',
  'admin.user.create': 'Usuário criado',
  'admin.user.update': 'Usuário atualizado',
  'admin.promotion.create': 'Promoção criada',
  'admin.promotion.update': 'Promoção atualizada',
  'admin.promotion.delete': 'Promoção removida',
};

export function AdminDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/admin/dashboard', { cache: 'no-store', signal: controller.signal })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || 'Não foi possível carregar o dashboard.');
        setData(result.data);
      })
      .catch((cause) => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Não foi possível carregar o dashboard.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);

  const cards = useMemo(() => data ? [
    { label: 'Usuários totais', value: data.stats.totalUsers, icon: Users },
    { label: `Ativos em ${data.activeWindowDays} dias`, value: data.stats.activeUsers, icon: Activity },
    { label: 'Pets cadastrados', value: data.stats.totalPets, icon: PawPrint },
    { label: 'Usuários com pet', value: data.stats.usersWithPets, icon: Cat },
    { label: 'Mensagens para IA', value: data.stats.chatMessages, icon: MessageCircle },
    { label: 'Conversas abertas', value: data.stats.chatThreads, icon: Bot },
  ] : [], [data]);

  if (loading) return <section className="admin-panel" role="status">Carregando dashboard…</section>;
  if (error || !data) return <section className="admin-panel"><p className="form-error" role="alert">{error || 'Não foi possível carregar o dashboard.'}</p></section>;

  return <div className="admin-dashboard">
    <div className="dashboard-metrics">
      {cards.map(({ label, value, icon: Icon }) => <article className="dashboard-metric" key={label}>
        <Icon size={20} aria-hidden="true" />
        <span>{label}</span>
        <strong>{value.toLocaleString('pt-BR')}</strong>
      </article>)}
    </div>
    <section className="admin-list">
      <div className="section-heading"><div><span className="eyebrow">ATIVIDADE</span><h2>Últimos registros</h2></div></div>
      {data.recentActivity.length === 0 ? <p className="empty-state">Nenhuma atividade registrada ainda.</p> : <div className="activity-list">
        {data.recentActivity.map((activity) => <article className="activity-item" key={activity.id}>
          <div><strong>{eventLabels[activity.event] || activity.event}</strong><span>{activity.userName || activity.userEmail || 'Usuário removido'}</span></div>
          <time dateTime={activity.createdAt}>{new Date(activity.createdAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</time>
        </article>)}
      </div>}
    </section>
  </div>;
}
