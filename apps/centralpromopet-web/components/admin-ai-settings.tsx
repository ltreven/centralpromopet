'use client';

import { FormEvent, useEffect, useState } from 'react';

type Config = {
  enabled: boolean; provider: 'vertex' | 'openai'; vertexModel: string; openaiModel: string;
  googleProject: string; googleLocation: string; openaiAuth: 'environment' | 'secret-manager';
  promotionsDays: number; promotionsLimit: number; dailyMessageLimit: number;
};
type Credentials = { vertexConfigured: boolean; openaiConfigured: boolean };
export function AdminAiSettings() {
  const [config, setConfig] = useState<Config | null>(null);
  const [credentials, setCredentials] = useState<Credentials | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/admin/ai-settings', { signal: controller.signal, cache: 'no-store' }).then(async (r) => {
      const result = await r.json(); if (!r.ok) throw new Error(result.message);
      setConfig(result.data.config); setCredentials(result.data.credentials);
    }).catch((e) => { if (!controller.signal.aborted) setError(e.message || 'Não foi possível carregar as configurações.'); });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(''), 5000);
    return () => window.clearTimeout(timer);
  }, [notice]);
  async function request(path: string, method: string, body: unknown) {
    setBusy(true); setError(''); setNotice('');
    try {
      const r = await fetch(`/api/admin/ai-settings${path}`, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const result = await r.json(); if (!r.ok) throw new Error(result.message);
      setNotice(path === '/test' ? `Conexão funcionando (${result.data.latencyMs} ms).` : path === '/credential' ? 'Credencial salva com segurança.' : 'Configurações salvas com sucesso.');
      if (path === '/credential') setApiKey('');
    } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível concluir.'); }
    finally { setBusy(false); }
  }
  function submit(e: FormEvent) { e.preventDefault(); void request('', 'PUT', config); }
  function change<K extends keyof Config>(key: K, value: Config[K]) { setConfig((c) => c ? { ...c, [key]: value } : c); }
  if (!config) return <p role={error ? 'alert' : 'status'}>{error || 'Carregando configurações…'}</p>;
  return <div className="ai-settings">
    {notice && <div className="toast" role="status">{notice}</div>}
    <section className="admin-panel"><h2>Assistente da Central</h2><p>Escolha o serviço usado nas conversas. Ao ativar, uma chamada curta verifica a conexão.</p>
      <form className="promotion-form" onSubmit={submit}>
        <label className="choice field-wide"><input type="checkbox" checked={config.enabled} onChange={(e) => change('enabled', e.target.checked)} />Disponibilizar chat para usuários logados</label>
        <label>Provedor<select value={config.provider} onChange={(e) => change('provider', e.target.value as Config['provider'])}><option value="vertex">Google Gemini — Vertex AI Express</option><option value="openai">OpenAI</option></select></label>
        <label>Modelo<select value={config.provider === 'vertex' ? config.vertexModel : config.openaiModel} onChange={(e) => change(config.provider === 'vertex' ? 'vertexModel' : 'openaiModel', e.target.value)}><option value={config.provider === 'vertex' ? 'gemini-2.5-flash-lite' : 'gpt-5-mini'}>{config.provider === 'vertex' ? 'Gemini 2.5 Flash-Lite' : 'GPT-5 mini'}</option></select></label>
        <label>Idade máxima das promoções<select value={config.promotionsDays} onChange={(e) => change('promotionsDays', Number(e.target.value))}>{[7, 14, 30, 60, 90, 180, 365].map((days) => <option key={days} value={days}>{days === 7 ? '1 semana' : days === 30 ? '1 mês (30 dias)' : `${days} dias`}</option>)}</select></label>
        <label>Ofertas por consulta<input type="number" min="1" max="12" value={config.promotionsLimit} onChange={(e) => change('promotionsLimit', Number(e.target.value))} required /></label>
        <p className="field-help field-wide">Conta a partir do cadastro da promoção. Só entram ofertas publicadas, já iniciadas e ainda válidas.</p>
        <label>Mensagens por usuário / dia<input type="number" min="1" max="200" value={config.dailyMessageLimit} onChange={(e) => change('dailyMessageLimit', Number(e.target.value))} required /></label>
        <div className="field-wide form-actions"><button className="button primary" disabled={busy} type="submit">{busy ? 'Aguarde…' : 'Salvar configurações'}</button><button className="button secondary" disabled={busy} type="button" onClick={() => request('/test', 'POST', config)}>Testar conexão</button></div>
      </form>
    </section>
    <section className="admin-panel"><h2>Chave de API — {config.provider === 'vertex' ? 'Google Gemini' : 'OpenAI'}</h2><p>{credentials?.[config.provider === 'vertex' ? 'vertexConfigured' : 'openaiConfigured'] ? 'Uma chave já está cadastrada. Informe outra somente se quiser substituí-la.' : 'Cadastre a chave usada pela Central para conversar com o modelo escolhido.'} Ela é criptografada no banco e nunca volta a ser exibida.</p><form className="promotion-form" autoComplete="off" onSubmit={(e) => { e.preventDefault(); void request('/credential', 'POST', { provider: config.provider, apiKey }); }}><label className="field-wide">Nova chave de API<input type="password" name="provider-api-key" autoComplete="off" spellCheck={false} placeholder={config.provider === 'vertex' ? 'AIza…' : 'sk-…'} value={apiKey} onChange={(e) => setApiKey(e.target.value)} minLength={20} maxLength={2048} required /></label><div className="field-wide"><button className="button secondary" disabled={busy}>Salvar / substituir chave</button></div></form></section>
    {error && <p className="form-error" role="alert">{error}</p>}
  </div>;
}
