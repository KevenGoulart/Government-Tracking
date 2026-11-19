import type { Serie } from './series';

/** Legenda única para os gráficos da comparação: a identidade nunca depende só da cor. */
export function Legenda({ series }: { series: Serie[] }) {
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm" aria-label="Legenda">
      {series.map((s) => (
        <li key={s.id} className="flex items-center gap-2">
          <span aria-hidden className="size-3 rounded-sm" style={{ backgroundColor: s.cor }} />
          {s.nome}
        </li>
      ))}
    </ul>
  );
}
