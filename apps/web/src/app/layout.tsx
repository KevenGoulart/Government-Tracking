import type { Metadata } from 'next';
import { Geist } from 'next/font/google';
import type { ReactNode } from 'react';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';
import { Providers } from './providers';
import './globals.css';

const geist = Geist({ subsets: ['latin'], variable: '--font-sans' });

export const metadata: Metadata = {
  title: { default: 'Raio-X Público', template: '%s · Raio-X Público' },
  description:
    'Explore como deputados federais usam a cota parlamentar, com dados abertos oficiais da Câmara dos Deputados.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning className={geist.variable}>
      <body className="flex min-h-dvh flex-col font-sans antialiased">
        <Providers>
          <a
            href="#conteudo"
            className="bg-primary text-primary-foreground sr-only z-50 rounded-md px-4 py-2 focus:not-sr-only focus:absolute focus:top-2 focus:left-2"
          >
            Pular para o conteúdo
          </a>
          <SiteHeader />
          <main id="conteudo" className="container mx-auto flex-1 px-4 py-8">
            {children}
          </main>
          <SiteFooter />
        </Providers>
      </body>
    </html>
  );
}
