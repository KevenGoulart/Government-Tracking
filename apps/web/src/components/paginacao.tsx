import { ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface PaginacaoProps {
  page: number;
  totalPages: number;
  /** Gera o href de uma página preservando os filtros atuais. */
  hrefPagina: (page: number) => string;
  className?: string;
}

const estiloLink =
  'inline-flex h-8 items-center gap-1 rounded-lg border px-2.5 text-sm font-medium hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 outline-none';

export function Paginacao({ page, totalPages, hrefPagina, className }: PaginacaoProps) {
  if (totalPages <= 1) return null;
  return (
    <nav
      aria-label="Paginação"
      className={cn('flex items-center justify-between gap-4', className)}
    >
      {page > 1 ? (
        <Link href={hrefPagina(page - 1)} className={estiloLink} rel="prev">
          <ChevronLeft className="size-4" aria-hidden /> Anterior
        </Link>
      ) : (
        <span />
      )}
      <span className="text-muted-foreground text-sm" aria-current="page">
        Página {page} de {totalPages}
      </span>
      {page < totalPages ? (
        <Link href={hrefPagina(page + 1)} className={estiloLink} rel="next">
          Próxima <ChevronRight className="size-4" aria-hidden />
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
