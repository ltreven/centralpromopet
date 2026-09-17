import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'Central Promo Pet | Ofertas para quem ama pets',
  description: 'Encontre promoções para o seu pet e acompanhe os achadinhos no nosso grupo de WhatsApp.',
  icons: { icon: '/logo.webp', apple: '/logo.webp' },
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
