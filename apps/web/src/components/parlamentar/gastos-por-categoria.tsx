import type { TotalCategoria } from '@raio-x/shared';
import { BarrasHorizontais } from '@/components/graficos/barras-horizontais';
import { caixaDeFrase } from '@/lib/format';

interface GastosPorCategoriaProps {
  categorias: TotalCategoria[];
  /** Quando informado, cada categoria vira um link (ex.: para filtrar a tabela). */
  hrefCategoria?: (slug: string) => string;
}

/** Total por categoria com a participação percentual no período. */
export function GastosPorCategoria({ categorias, hrefCategoria }: GastosPorCategoriaProps) {
  const total = categorias.reduce((soma, c) => soma + Math.max(Number(c.total), 0), 0);
  return (
    <BarrasHorizontais
      vazio="Nenhuma despesa no período."
      itens={categorias.map((c) => ({
        chave: c.slug,
        rotulo: caixaDeFrase(c.nome),
        valor: Number(c.total),
        detalhe: total > 0 ? `${Math.round((Number(c.total) / total) * 100)}%` : undefined,
        href: hrefCategoria?.(c.slug),
      }))}
    />
  );
}
