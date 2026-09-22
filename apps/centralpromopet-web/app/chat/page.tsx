import { ChatScreen } from '@/components/chatbot';
import { SiteHeader } from '@/components/site-header';
import { requireSession } from '@/lib/session';

export default async function ChatPage({ searchParams }: { searchParams: Promise<{ q?: string | string[]; thread?: string }> }) {
  const params = await searchParams;
  const initialPrompt = Array.isArray(params.q) ? params.q[0] || '' : params.q || '';
  const thread = typeof params.thread === 'string' ? params.thread : '';
  const next = thread ? `/chat?thread=${encodeURIComponent(thread)}` : initialPrompt ? `/chat?q=${encodeURIComponent(initialPrompt.slice(0, 200))}` : '/chat';
  const user = await requireSession(false, next);
  const firstName = user.displayName?.trim().split(/\s+/)[0] || user.email.split('@')[0];
  return <>
    <SiteHeader />
    <main className="chat-page container">
      <ChatScreen key={`${thread}:${initialPrompt}`} firstName={firstName} initialThread={thread} initialPrompt={initialPrompt.slice(0, 200)} />
    </main>
  </>;
}
