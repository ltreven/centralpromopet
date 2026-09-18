'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowUp } from 'lucide-react';

type PetFilter = 'dogs' | 'cats' | 'all';
type Message = { id: number; from: 'bot' | 'user'; text: string; action?: { label: string; href: string } };
const suggestions: { label: string; pet: PetFilter }[] = [
  { label: '🐶 Ofertas para cães', pet: 'dogs' },
  { label: '🐱 Ofertas para gatos', pet: 'cats' },
  { label: '✨ Ver tudo', pet: 'all' },
];

function DogRobot({ size = 24 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden="true">
    <path d="M17 18C9 12 4 18 6 29c1 7 5 12 12 13M47 18c8-6 13 0 11 11-1 7-5 12-12 13" fill="#C98735" stroke="#5A321E" strokeWidth="2.5" strokeLinejoin="round" />
    <path d="M32 4v7" stroke="#5A321E" strokeWidth="3" strokeLinecap="round" /><circle cx="32" cy="4" r="3" fill="#F25A24" stroke="#5A321E" strokeWidth="1.5" />
    <path d="M17 18c0-7 7-11 15-11s15 4 15 11v17c0 11-6 19-15 19s-15-8-15-19V18Z" fill="#F2B35B" stroke="#5A321E" strokeWidth="2.5" />
    <rect x="3" y="26" width="5" height="10" rx="2.5" fill="#0B603A" stroke="#5A321E" strokeWidth="1.5" /><rect x="56" y="26" width="5" height="10" rx="2.5" fill="#0B603A" stroke="#5A321E" strokeWidth="1.5" />
    <circle cx="25" cy="30" r="3" fill="#39251F" /><circle cx="39" cy="30" r="3" fill="#39251F" /><circle cx="26" cy="29" r=".8" fill="white" /><circle cx="40" cy="29" r=".8" fill="white" />
    <path d="M19 39c1-4 6-6 13-6s12 2 13 6c1 7-6 12-13 12s-14-5-13-12Z" fill="#FFF0D7" stroke="#5A321E" strokeWidth="2" />
    <path d="M28 39c0-2 2-3 4-3s4 1 4 3-2 3-4 3-4-1-4-3Z" fill="#39251F" /><path d="M32 42v3m0 0c-2 2-4 2-6 0m6 0c2 2 4 2 6 0" stroke="#5A321E" strokeWidth="1.8" strokeLinecap="round" />
  </svg>;
}

export function Chatbot() {
  return <Link href="/chat" className="chat-launcher" aria-label="Abrir conversa com o assistente" title="Abrir conversa com o assistente"><DogRobot size={34} /></Link>;
}

export function ChatScreen() {
  const [text, setText] = useState('');
  const endOfMessages = useRef<HTMLDivElement>(null);
  const [messages, setMessages] = useState<Message[]>([
    { id: 0, from: 'bot', text: 'Oi! Sou o assistente da Central Promo Pet. Posso ajudar você a encontrar ofertas para o seu pet.' },
  ]);
  useEffect(() => endOfMessages.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }), [messages]);

  function reply(value: string, pet?: PetFilter) {
    const trimmed = value.trim();
    const selectedPet = pet ?? 'all';
    const petLabel = selectedPet === 'dogs' ? 'cães' : selectedPet === 'cats' ? 'gatos' : 'todos os pets';
    const query = trimmed ? `?q=${encodeURIComponent(trimmed)}` : `?pet=${selectedPet}`;
    const action = {
      label: trimmed ? `Ver ofertas para “${trimmed}”` : `Ver ofertas para ${petLabel}`,
      href: `/${query}#promocoes`,
    };
    setMessages((current) => [
      ...current,
      ...(trimmed ? [{ id: Date.now(), from: 'user' as const, text: trimmed }] : []),
      {
        id: Date.now() + 1,
        from: 'bot',
        text: trimmed
          ? `Ainda sou um assistente de demonstração, mas posso filtrar as ofertas por “${trimmed}” para você.`
          : `Certo! Separei as ofertas para ${petLabel}.`,
        action,
      },
    ]);
    setText('');
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (text.trim()) reply(text);
  }

  return <section className="chat-screen" aria-label="Conversa com o assistente">
    <header className="chat-screen-header">
      <span className="chat-avatar"><DogRobot size={30} /></span>
      <div><strong>Assistente Central</strong><small>Assistente demonstrativo</small></div>
      <span className="chat-online"><span /> Online</span>
    </header>
    <div className="chat-screen-messages" aria-live="polite">
      <p className="chat-date">Hoje</p>
      {messages.map((message) => <div className={`chat-row ${message.from}`} key={message.id}>
        {message.from === 'bot' && <span className="chat-mini-avatar"><DogRobot size={20} /></span>}
        <div className={`chat-message ${message.from}`}>
          <p>{message.text}</p>
          {message.action && <Link className="chat-action" href={message.action.href}>{message.action.label}</Link>}
        </div>
      </div>)}
      {messages.length === 1 && <div className="chat-suggestions">{suggestions.map((suggestion) => <button type="button" key={suggestion.pet} onClick={() => reply('', suggestion.pet)}>{suggestion.label}</button>)}</div>}
      <div ref={endOfMessages} />
    </div>
    <form className="chat-screen-form" onSubmit={submit}>
      <input aria-label="Digite o que procura" placeholder="Ex.: ração para gatos" value={text} onChange={(event) => setText(event.target.value)} />
      <button type="submit" aria-label="Enviar mensagem" disabled={!text.trim()}><ArrowUp size={19} /></button>
    </form>
    <p className="chat-disclaimer">As respostas são automáticas. O assistente ainda não usa inteligência artificial.</p>
  </section>;
}
