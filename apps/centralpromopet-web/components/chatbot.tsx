'use client';

import { FormEvent, useState } from 'react';
import { ArrowUp, Bot, MessageCircle, X } from 'lucide-react';
import type { PetFilter } from '@/components/promotions';

type Message = { id: number; from: 'bot' | 'user'; text: string };
const suggestions: { label: string; pet: PetFilter }[] = [
  { label: '🐶 Ofertas para cães', pet: 'dogs' },
  { label: '🐱 Ofertas para gatos', pet: 'cats' },
  { label: '✨ Ver tudo', pet: 'all' },
];

export function Chatbot({ onSearch }: { onSearch: (value: string, pet?: PetFilter) => void }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [messages, setMessages] = useState<Message[]>([{ id: 0, from: 'bot', text: 'Oi! Posso ajudar a encontrar um bom garimpo para o seu pet. O que você procura?' }]);

  function reply(value: string, pet?: PetFilter) {
    const trimmed = value.trim();
    const selectedPet = pet ?? 'all';
    setMessages((current) => [
      ...current,
      ...(trimmed ? [{ id: Date.now(), from: 'user' as const, text: trimmed }] : []),
      { id: Date.now() + 1, from: 'bot', text: trimmed ? `Certo! Vou filtrar as ofertas por “${trimmed}”.` : `Separei as ofertas para ${selectedPet === 'dogs' ? 'cães' : selectedPet === 'cats' ? 'gatos' : 'todos os pets'}.` },
    ]);
    onSearch(trimmed, pet);
    setText('');
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (text.trim()) reply(text);
  }

  return <div className="chatbot">
    {open && <section className="chat-panel" aria-label="Assistente demonstrativo" aria-live="polite">
      <header className="chat-header"><span className="chat-avatar"><Bot size={20} /></span><div><strong>Posso te ajudar?</strong><small>Assistente demonstrativo</small></div><button type="button" className="chat-close" onClick={() => setOpen(false)} aria-label="Fechar conversa"><X size={19} /></button></header>
      <div className="chat-messages">{messages.map((message) => <p className={`chat-message ${message.from}`} key={message.id}>{message.text}</p>)}</div>
      {messages.length === 1 && <div className="chat-suggestions">{suggestions.map((suggestion) => <button type="button" key={suggestion.pet} onClick={() => reply('', suggestion.pet)}>{suggestion.label}</button>)}</div>}
      <form className="chat-form" onSubmit={submit}><input aria-label="Digite o que procura" placeholder="Ex.: ração para gatos" value={text} onChange={(event) => setText(event.target.value)} /><button type="submit" aria-label="Enviar mensagem" disabled={!text.trim()}><ArrowUp size={18} /></button></form>
      <small className="chat-disclaimer">As respostas são automáticas e só filtram as ofertas disponíveis.</small>
    </section>}
    <button type="button" className="chat-launcher" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
      {open ? <X size={20} /> : <MessageCircle size={20} />}{open ? 'Fechar' : 'Posso te ajudar?'}
    </button>
  </div>;
}
