import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { ChatScreen } from '@/components/chatbot';
import { SiteHeader } from '@/components/site-header';

export default async function ChatPage({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  const params = await searchParams;
  const initialPrompt = Array.isArray(params.q) ? params.q[0] || '' : params.q || '';
  return <>
    <SiteHeader />
    <main className="chat-page container">
      <Link href="/" className="chat-back"><ArrowLeft size={17} /> Voltar para as ofertas</Link>
      <div className="chat-page-heading"><span className="eyebrow">CENTRAL PROMO PET</span><h1>Vamos encontrar um bom garimpo?</h1><p>Conte o que seu pet precisa ou escolha uma opção abaixo.</p></div>
      <ChatScreen key={initialPrompt} initialPrompt={initialPrompt.slice(0, 200)} />
    </main>
  </>;
}
