'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowUp } from 'lucide-react';

type PetFilter = 'dogs' | 'cats' | 'all';
type Message = { id: number; from: 'bot' | 'user'; text: string; action?: { label: string; href: string } };
const suggestions: { label: string; pet: PetFilter }[] = [
  { label: '🐶 Ofertas para cães', pet: 'dogs' },
  { label: '🐱 Ofertas para gatos', pet: 'cats' },
  { label: '✨ Ver tudo', pet: 'all' },
];

function createAction(value: string, pet?: PetFilter) {
  const selectedPet = pet ?? 'all';
  const petLabel = selectedPet === 'dogs' ? 'cães' : selectedPet === 'cats' ? 'gatos' : 'todos os pets';
  const query = value ? `?q=${encodeURIComponent(value)}` : `?pet=${selectedPet}`;
  return {
    label: value ? `Ver ofertas para “${value}”` : `Ver ofertas para ${petLabel}`,
    href: `/${query}#promocoes`,
  };
}

function responseFor(value: string, id: number, pet?: PetFilter): Message {
  const selectedPet = pet ?? 'all';
  const petLabel = selectedPet === 'dogs' ? 'cães' : selectedPet === 'cats' ? 'gatos' : 'todos os pets';
  return {
    id,
    from: 'bot',
    text: value
      ? `Ainda sou um assistente de demonstração, mas posso filtrar as ofertas por “${value}” para você.`
      : `Certo! Separei as ofertas para ${petLabel}.`,
    action: createAction(value, pet),
  };
}

export function ChatScreen({ initialPrompt = '' }: { initialPrompt?: string }) {
  const [text, setText] = useState('');
  const endOfMessages = useRef<HTMLDivElement>(null);
  const [messages, setMessages] = useState<Message[]>(() => {
    const trimmedPrompt = initialPrompt.trim().slice(0, 200);
    const welcome: Message = { id: 0, from: 'bot', text: 'Oi! Sou o assistente da Central Promo Pet. Conte o que seu pet precisa.' };
    return trimmedPrompt ? [welcome, { id: 1, from: 'user', text: trimmedPrompt }, responseFor(trimmedPrompt, 2)] : [welcome];
  });
  useEffect(() => endOfMessages.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }), [messages]);

  function reply(value: string, pet?: PetFilter) {
    const trimmed = value.trim();
    setMessages((current) => [
      ...current,
      ...(trimmed ? [{ id: Date.now(), from: 'user' as const, text: trimmed }] : []),
      responseFor(trimmed, Date.now() + 1, pet),
    ]);
    setText('');
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (text.trim()) reply(text);
  }

  return <section className="chat-screen" aria-label="Conversa com o assistente">
    <header className="chat-screen-header">
      <span className="chat-avatar"><Image src="/logo.webp" width={36} height={36} alt="" /></span>
      <div><strong>Assistente Central</strong><small>Assistente demonstrativo</small></div>
      <span className="chat-online"><span /> Online</span>
    </header>
    <div className="chat-screen-messages" aria-live="polite">
      <p className="chat-date">Hoje</p>
      {messages.map((message) => <div className={`chat-row ${message.from}`} key={message.id}>
        {message.from === 'bot' && <span className="chat-mini-avatar"><Image src="/logo.webp" width={24} height={24} alt="" /></span>}
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
