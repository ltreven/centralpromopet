'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowUp, Sparkles } from 'lucide-react';

type Offer = { id: string; title: string; store: string; priceCents: number; currency: string; coupon: string | null; affiliateUrl: string; endsAt: string };
type Message = { id: string; role: string; content: string; promotionIds: string[] };
type Action = { id: string; label: string };
function OfferCard({ offer }: { offer: Offer }) {
  if (!offer.affiliateUrl.startsWith('https://') || new Date(offer.endsAt) <= new Date()) return null;
  return <article className="chat-offer"><strong>{offer.title}</strong><span>{offer.store}</span><b>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: offer.currency }).format(offer.priceCents / 100)}</b>{offer.coupon && <span>Cupom: {offer.coupon}</span>}<a href={offer.affiliateUrl} target="_blank" rel="noopener noreferrer sponsored" className="button primary">Ver oferta</a></article>;
}
function ThinkingIndicator() {
  return <div className="chat-thinking" role="status" aria-label="Preparando resposta"><span aria-hidden="true" /><span aria-hidden="true" /><span aria-hidden="true" /></div>;
}
export function ChatScreen({ firstName, initialPrompt = '', initialThread = '' }: { firstName: string; initialPrompt?: string; initialThread?: string }) {
  const [text, setText] = useState(initialPrompt);
  const [threadId, setThreadId] = useState(initialThread);
  const [messages, setMessages] = useState<Message[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [actions, setActions] = useState<Action[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const endOfMessages = useRef<HTMLDivElement>(null);
  const requestInFlight = useRef(false);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const selected = initialThread;
        if (selected) {
          const r = await fetch(`/api/chat/threads/${encodeURIComponent(selected)}`, { cache: 'no-store', signal: controller.signal });
          const body = await r.json(); if (!r.ok) throw new Error(body.message);
          setMessages(body.data.messages); setActions(body.data.actions); setOffers(body.data.offers);
          setThreadId(selected);
        }
      } catch (e) { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Não foi possível carregar as conversas.'); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    }
    void load(); return () => controller.abort();
  }, [initialThread, initialPrompt]);
  useEffect(() => {
    if (messages.length || busy) endOfMessages.current?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'end' });
  }, [messages, actions, busy]);
  async function reply(value: string) {
    if (requestInFlight.current || !value.trim()) return;
    requestInFlight.current = true; setBusy(true); setError(''); setNotice('');
    const messageId = crypto.randomUUID();
    const content = value.trim();
    setText('');
    setMessages((current) => [...current, { id: messageId, role: 'user', content, promotionIds: [] }]);
    try {
      const r = await fetch('/api/chat/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...(threadId ? { threadId } : {}), message: value.trim() }) });
      const result = await r.json(); if (!r.ok) throw new Error(result.message);
      const data = result.data;
      setThreadId(data.threadId);
      setMessages((current) => [...current, { id: crypto.randomUUID(), role: 'assistant', content: data.answer, promotionIds: data.offers.map((offer: Offer) => offer.id) }]);
      setOffers((current) => [...current.filter((o) => !data.offers.some((offer: Offer) => offer.id === o.id)), ...data.offers]);
      setActions(data.actions);
      if (data.remembered.length) setNotice(`Vou lembrar: ${data.remembered.join(' · ')}`);
    } catch (e) {
      setMessages((current) => current.filter((message) => message.id !== messageId));
      setText(value);
      setError(e instanceof Error ? e.message : 'Não foi possível enviar. Tente novamente.');
    }
    finally { requestInFlight.current = false; setBusy(false); }
  }
  async function decide(action: Action, approved: boolean) {
    if (requestInFlight.current) return;
    requestInFlight.current = true; setBusy(true); setError('');
    try {
      const r = await fetch(`/api/chat/actions/${action.id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ approved }) });
      const result = await r.json(); if (!r.ok) throw new Error(result.message);
      setActions((current) => current.filter((item) => item.id !== action.id));
      setNotice(result.data.status === 'confirmed' ? 'Solicitação concluída.' : 'Essa solicitação foi cancelada.');
      // Reload authoritative state; pet deletion can clear the conversation.
      const history = await fetch(`/api/chat/threads/${threadId}`, { cache: 'no-store' });
      const state = await history.json(); if (!history.ok) throw new Error('A confirmação foi processada, mas não foi possível atualizar a conversa. Recarregue a página.');
      setMessages(state.data.messages); setActions(state.data.actions); setOffers(state.data.offers);
      setNotice('');
    } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível concluir.'); }
    finally { requestInFlight.current = false; setBusy(false); }
  }
  function submit(event: FormEvent) { event.preventDefault(); void reply(text); }
  const hasConversation = messages.length > 0 || actions.length > 0 || busy || Boolean(initialThread && loading);
  return <div className={`chat-workspace${hasConversation ? ' has-conversation' : ''}`}>
    <section className="chat-screen" aria-label="IA da Central">
      {!hasConversation && <div className="chat-welcome"><Sparkles size={32} aria-hidden="true" /><h1>Olá, {firstName}!<span>Vamos cuidar do seu pet juntos?</span></h1></div>}
      {hasConversation && <div className="chat-screen-messages" aria-live="polite" aria-relevant="additions text">
        {loading && <ThinkingIndicator />}
        {messages.map((message) => <div className={`chat-row ${message.role === 'user' ? 'user' : 'bot'}`} key={message.id}><div className={`chat-message ${message.role === 'user' ? 'user' : 'bot'}`}><p>{message.content}</p>{message.promotionIds.map((id) => { const offer = offers.find((o) => o.id === id); return offer ? <OfferCard offer={offer} key={id} /> : null; })}</div></div>)}
        {actions.map((action) => <div className="chat-confirmation" key={action.id}><strong>Posso fazer isso para você?</strong><p>{action.label}</p><div className="form-actions"><button className="button primary" disabled={busy} onClick={() => decide(action, true)}>Confirmar</button><button className="button secondary" disabled={busy} onClick={() => decide(action, false)}>Cancelar</button></div></div>)}
        {notice && <p className="form-success" role="status">{notice}</p>}
        {busy && <ThinkingIndicator />}
        <div ref={endOfMessages} />
      </div>}
      {error && <p className="form-error" role="alert">{error}</p>}
      <form className="chat-screen-form" onSubmit={submit}><textarea rows={2} aria-label="Sua mensagem" placeholder={hasConversation ? 'Continue a conversa…' : 'O que você quer saber sobre seu pet?'} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); if (!busy && !loading) void reply(text); } }} maxLength={2000} disabled={busy || loading} /><button type="submit" aria-label="Enviar mensagem" disabled={busy || loading || !text.trim()}><ArrowUp size={21} aria-hidden="true" /></button></form>
    </section>
    <footer className="chat-footer"><p className="chat-disclaimer">A IA pode errar. Orientações gerais não substituem um veterinário. Confira preço e disponibilidade na loja.</p><Link href="/dashboard/memory" className="chat-memory-link">O que a IA da Central sabe sobre mim</Link></footer>
  </div>;
}
