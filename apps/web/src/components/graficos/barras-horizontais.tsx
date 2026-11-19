import Link from 'next/link';
import { formatarMoeda } from '@/lib/format';

export interface ItemBarra {
  chave: string;
  rotulo: string;
  valor: number;
  /** Texto extra ao lado do valor (ex.: "29%" ou "média R$ 256 mil"). */
  detalhe?: string;
  href?: string;
}

/**
 * Barras horizontais em HTML, série única: rótulo e valor sempre visíveis (acessível sem
 * tooltip nem JavaScript), comprimento proporcional ao maior valor positivo.
 */
export function BarrasHorizontais({ itens, vazio }: { itens: ItemBarra[]; vazio: string }) {
  const positivos = itens.filter((i) => i.valor > 0);
  if (positivos.length === 0) return <p className="text-muted-foreground text-sm">{vazio}</p>;
  const maior = Math.max(...positivos.map((i) => i.valor));

  return (
    <ul className="space-y-3">
      {positivos.map((item) => {
        const conteudo = (
          <>
            <div className="flex items-baseline justify-between gap-4 text-sm">
              <span className={item.href ? 'group-hover:underline' : undefined}>{item.rotulo}</span>
              <span className="text-muted-foreground shrink-0 tabular-nums">
                {formatarMoeda(item.valor)}
                {item.detalhe && ` · ${item.detalhe}`}
              </span>
            </div>
            <div className="mt-1 h-2 w-full" aria-hidden>
              <div
                className="bg-viz-series-1 h-full rounded-r-[4px]"
                style={{ width: `${Math.max((item.valor / maior) * 100, 0.5)}%` }}
              />
            </div>
          </>
        );
        return (
          <li key={item.chave}>
            {item.href ? (
              <Link
                href={item.href}
                className="group focus-visible:ring-ring/50 block rounded-md outline-none focus-visible:ring-3"
              >
                {conteudo}
              </Link>
            ) : (
              conteudo
            )}
          </li>
        );
      })}
    </ul>
  );
}
