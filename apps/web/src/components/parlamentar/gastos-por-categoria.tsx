import type { TotalCategoria } from '@raio-x/shared';
import Link from 'next/link';
import { caixaDeFrase, formatarMoeda } from '@/lib/format';

interface GastosPorCategoriaProps {
  categorias: TotalCategoria[];
  /** Link para filtrar a tabela de despesas pela categoria. */
  hrefCategoria: (slug: string) => string;
}

/**
 * Barras horizontais em HTML: rótulo e valor sempre visíveis (acessível sem tooltip),
 * comprimento proporcional à maior categoria, uma única cor.
 */
export function GastosPorCategoria({ categorias, hrefCategoria }: GastosPorCategoriaProps) {
  const positivas = categorias.filter((c) => Number(c.total) > 0);
  const maior = Math.max(...positivas.map((c) => Number(c.total)), 1);
  const total = positivas.reduce((soma, c) => soma + Number(c.total), 0);

  if (positivas.length === 0) {
    return <p className="text-muted-foreground text-sm">Nenhuma despesa no período.</p>;
  }

  return (
    <ul className="space-y-3">
      {positivas.map((c) => {
        const valor = Number(c.total);
        const percentual = Math.round((valor / total) * 100);
        return (
          <li key={c.slug}>
            <Link
              href={hrefCategoria(c.slug)}
              className="group focus-visible:ring-ring/50 block rounded-md outline-none focus-visible:ring-3"
            >
              <div className="flex items-baseline justify-between gap-4 text-sm">
                <span className="group-hover:underline">{caixaDeFrase(c.nome)}</span>
                <span className="text-muted-foreground shrink-0 tabular-nums">
                  {formatarMoeda(valor)} · {percentual}%
                </span>
              </div>
              <div className="mt-1 h-2 w-full" aria-hidden>
                <div
                  className="bg-viz-series-1 h-full rounded-r-[4px]"
                  style={{ width: `${Math.max((valor / maior) * 100, 0.5)}%` }}
                />
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
