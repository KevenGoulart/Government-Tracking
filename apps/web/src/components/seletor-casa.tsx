import type { Casa } from '@raio-x/shared';
import Link from 'next/link';
import { CASAS } from '@/lib/casa';
import { cn } from '@/lib/utils';

interface SeletorCasaProps {
  selecionada: Casa;
  hrefCasa: (casa: Casa) => string;
}

/** Alterna entre Câmara e Senado: as cotas são diferentes e nunca são somadas. */
export function SeletorCasa({ selecionada, hrefCasa }: SeletorCasaProps) {
  return (
    <nav aria-label="Casa legislativa" className="bg-muted inline-flex rounded-lg p-1">
      {(Object.keys(CASAS) as Casa[]).map((casa) => {
        const ativa = casa === selecionada;
        return (
          <Link
            key={casa}
            href={hrefCasa(casa)}
            aria-current={ativa ? 'page' : undefined}
            className={cn(
              'focus-visible:ring-ring/50 rounded-md px-3 py-1 text-sm font-medium outline-none focus-visible:ring-3',
              ativa
                ? 'bg-background shadow-sm'
                : 'text-secondary-foreground hover:bg-background/60',
            )}
          >
            {CASAS[casa].nome}
          </Link>
        );
      })}
    </nav>
  );
}
