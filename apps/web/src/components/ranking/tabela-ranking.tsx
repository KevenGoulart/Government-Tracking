import type { RankingItem } from '@raio-x/shared';
import Link from 'next/link';
import { FotoParlamentar } from '@/components/foto-parlamentar';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatarMoeda } from '@/lib/format';
import { hrefParlamentar } from '@/lib/links';

interface TabelaRankingProps {
  itens: RankingItem[];
  legenda: string;
}

export function TabelaRanking({ itens, legenda }: TabelaRankingProps) {
  if (itens.length === 0) {
    return (
      <p className="text-muted-foreground rounded-lg border border-dashed p-8 text-center text-sm">
        Nenhum parlamentar com despesas para esses filtros.
      </p>
    );
  }
  return (
    <div className="rounded-lg border">
      <Table>
        <TableCaption className="sr-only">{legenda}</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12 text-right">#</TableHead>
            <TableHead>Parlamentar</TableHead>
            <TableHead className="text-right">
              <span className="sm:hidden">Total</span>
              <span className="hidden sm:inline">Total (valor líquido)</span>
            </TableHead>
            <TableHead className="hidden text-right sm:table-cell">Despesas</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {itens.map(({ posicao, parlamentar, total, quantidade }) => (
            <TableRow key={parlamentar.id}>
              <TableCell className="text-muted-foreground text-right tabular-nums">
                {posicao}
              </TableCell>
              <TableCell>
                <Link
                  href={hrefParlamentar(parlamentar.id)}
                  className="flex items-center gap-3 underline-offset-4 hover:underline"
                >
                  <FotoParlamentar
                    nome={parlamentar.nome}
                    fotoUrl={parlamentar.fotoUrl}
                    tamanho={32}
                  />
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{parlamentar.nome}</span>
                    <span className="text-muted-foreground text-xs">
                      {[parlamentar.partido, parlamentar.uf].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                </Link>
              </TableCell>
              <TableCell className="text-right font-medium tabular-nums">
                {formatarMoeda(total)}
              </TableCell>
              <TableCell className="hidden text-right tabular-nums sm:table-cell">
                {quantidade.toLocaleString('pt-BR')}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
