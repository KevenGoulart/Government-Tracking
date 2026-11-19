import { Suspense } from 'react';
import { SyncInfo } from './sync-info';

export function SiteFooter() {
  return (
    <footer className="text-muted-foreground border-t text-sm">
      <div className="container mx-auto space-y-1 px-4 py-6">
        <p>
          Fonte:{' '}
          <a
            href="https://dadosabertos.camara.leg.br"
            className="hover:text-foreground underline underline-offset-4"
            target="_blank"
            rel="noreferrer"
          >
            Dados Abertos da Câmara dos Deputados
          </a>
          ,{' '}
          <a
            href="https://www2.camara.leg.br/transparencia/cota-para-exercicio-da-atividade-parlamentar/dados-abertos-cota-parlamentar"
            className="hover:text-foreground underline underline-offset-4"
            target="_blank"
            rel="noreferrer"
          >
            Cota Parlamentar da Câmara
          </a>
          ,{' '}
          <a
            href="https://www12.senado.leg.br/dados-abertos"
            className="hover:text-foreground underline underline-offset-4"
            target="_blank"
            rel="noreferrer"
          >
            Dados Abertos do Senado
          </a>{' '}
          e{' '}
          <a
            href="https://portaldatransparencia.gov.br/emendas"
            className="hover:text-foreground underline underline-offset-4"
            target="_blank"
            rel="noreferrer"
          >
            Portal da Transparência (emendas)
          </a>
          .
        </p>
        <Suspense fallback={null}>
          <SyncInfo />
        </Suspense>
      </div>
    </footer>
  );
}
