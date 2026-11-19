import Link from 'next/link';
import { cn } from '@/lib/utils';

interface SeletorAnoProps {
  anos: number[];
  selecionado: number;
  hrefAno: (ano: number) => string;
}

export function SeletorAno({ anos, selecionado, hrefAno }: SeletorAnoProps) {
  if (anos.length <= 1) return null;
  return (
    <nav aria-label="Ano" className="bg-muted inline-flex rounded-lg p-1">
      {anos.map((ano) => {
        const ativo = ano === selecionado;
        return (
          <Link
            key={ano}
            href={hrefAno(ano)}
            aria-current={ativo ? 'page' : undefined}
            className={cn(
              'focus-visible:ring-ring/50 rounded-md px-3 py-1 text-sm font-medium tabular-nums outline-none focus-visible:ring-3',
              ativo
                ? 'bg-background shadow-sm'
                : 'text-secondary-foreground hover:bg-background/60',
            )}
          >
            {ano}
          </Link>
        );
      })}
    </nav>
  );
}
