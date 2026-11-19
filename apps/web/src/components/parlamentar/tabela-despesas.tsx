import type { Categoria, Despesa, DespesasQuery } from '@raio-x/shared';
import { ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  caixaDeFrase,
  formatarData,
  formatarDocumento,
  formatarMoeda,
  nomeMes,
  nomeMesCurto,
} from '@/lib/format';
import { hrefFornecedor } from '@/lib/links';
import { CampoSelect } from '../campo-select';

interface FiltrosDespesasProps {
  acao: string;
  ano: number;
  categorias: Categoria[];
  valores: Pick<DespesasQuery, 'mes' | 'categoria' | 'ordenarPor' | 'ordem'>;
}

/** Filtros da tabela em formulário GET (refletidos na URL, funcionam sem JavaScript). */
export function FiltrosDespesas({ acao, ano, categorias, valores }: FiltrosDespesasProps) {
  const ordenacao = `${valores.ordenarPor}-${valores.ordem}`;
  return (
    <form
      action={`${acao}#despesas`}
      method="get"
      aria-label="Filtrar despesas"
      className="grid gap-3 sm:grid-cols-[8rem_1fr_11rem_auto] sm:items-end"
    >
      <input type="hidden" name="ano" value={ano} />
      <div className="space-y-1.5">
        <label htmlFor="mes" className="text-sm font-medium">
          Mês
        </label>
        <CampoSelect id="mes" name="mes" defaultValue={valores.mes ?? ''}>
          <option value="">Todos</option>
          {Array.from({ length: 12 }, (_, i) => (
            <option key={i + 1} value={i + 1} className="capitalize">
              {nomeMes(i + 1)}
            </option>
          ))}
        </CampoSelect>
      </div>
      <div className="space-y-1.5">
        <label htmlFor="categoria" className="text-sm font-medium">
          Categoria
        </label>
        <CampoSelect id="categoria" name="categoria" defaultValue={valores.categoria ?? ''}>
          <option value="">Todas</option>
          {categorias.map((c) => (
            <option key={c.slug} value={c.slug}>
              {caixaDeFrase(c.nome)}
            </option>
          ))}
        </CampoSelect>
      </div>
      <div className="space-y-1.5">
        <label htmlFor="ordenacao" className="text-sm font-medium">
          Ordenar por
        </label>
        {/* Um único select; a página traduz `ordenacao` em `ordenarPor` + `ordem`. */}
        <CampoSelect id="ordenacao" name="ordenacao" defaultValue={ordenacao}>
          <option value="data-desc">Mais recentes</option>
          <option value="data-asc">Mais antigas</option>
          <option value="valor-desc">Maior valor</option>
          <option value="valor-asc">Menor valor</option>
        </CampoSelect>
      </div>
      <Button type="submit" variant="outline">
        Filtrar
      </Button>
    </form>
  );
}

export function TabelaDespesas({ despesas, total }: { despesas: Despesa[]; total: number }) {
  if (despesas.length === 0) {
    return (
      <p className="text-muted-foreground rounded-lg border border-dashed p-8 text-center text-sm">
        Nenhuma despesa encontrada com esses filtros.
      </p>
    );
  }
  return (
    <>
      {/* Celular: lista empilhada, sem rolagem horizontal */}
      <ul className="divide-y rounded-lg border md:hidden" aria-label="Despesas">
        {despesas.map((d) => (
          <li key={d.id} className="space-y-1 p-4 text-sm">
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-medium">{caixaDeFrase(d.categoria.nome)}</span>
              <span className="shrink-0 font-semibold tabular-nums">
                {formatarMoeda(d.valorLiquido)}
              </span>
            </div>
            <p className="text-muted-foreground break-words">
              {d.fornecedor ? (
                <Link
                  href={hrefFornecedor(d.fornecedor)}
                  className="underline-offset-4 hover:underline"
                >
                  {d.fornecedor.nome}
                </Link>
              ) : (
                '—'
              )}
            </p>
            <div className="text-muted-foreground flex items-center justify-between gap-3 text-xs">
              <span className="tabular-nums">
                {formatarData(d.dataDocumento)} · competência {nomeMesCurto(d.mes)}/{d.ano}
              </span>
              {d.urlDocumento && (
                <a
                  href={d.urlDocumento}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary inline-flex items-center gap-1 underline-offset-4 hover:underline"
                >
                  Nota fiscal <ExternalLink className="size-3" aria-hidden />
                  <span className="sr-only">(abre em nova aba)</span>
                </a>
              )}
            </div>
          </li>
        ))}
      </ul>
      <div className="hidden rounded-lg border md:block">
        <Table>
          <TableCaption className="sr-only">
            Despesas da cota parlamentar ({total} no total)
          </TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Competência</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Fornecedor</TableHead>
              <TableHead className="text-right">Valor líquido</TableHead>
              <TableHead>
                <span className="sr-only">Documento</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {despesas.map((d) => (
              <TableRow key={d.id}>
                <TableCell className="tabular-nums">{formatarData(d.dataDocumento)}</TableCell>
                <TableCell className="tabular-nums">
                  {nomeMesCurto(d.mes)}/{d.ano}
                </TableCell>
                <TableCell className="max-w-56 truncate" title={caixaDeFrase(d.categoria.nome)}>
                  {caixaDeFrase(d.categoria.nome)}
                </TableCell>
                <TableCell className="max-w-64">
                  {d.fornecedor ? (
                    <Link
                      href={hrefFornecedor(d.fornecedor)}
                      className="block truncate underline-offset-4 hover:underline"
                      title={d.fornecedor.nome}
                    >
                      {d.fornecedor.nome}
                    </Link>
                  ) : (
                    '—'
                  )}
                  {d.fornecedor?.documento && (
                    <span className="text-muted-foreground text-xs tabular-nums">
                      {formatarDocumento(d.fornecedor.documento)}
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-right font-medium tabular-nums">
                  {formatarMoeda(d.valorLiquido)}
                </TableCell>
                <TableCell>
                  {d.urlDocumento ? (
                    <Link
                      href={d.urlDocumento}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary inline-flex items-center gap-1 text-sm underline-offset-4 hover:underline"
                    >
                      Nota fiscal
                      <ExternalLink className="size-3.5" aria-hidden />
                      <span className="sr-only">(abre em nova aba)</span>
                    </Link>
                  ) : (
                    <span className="text-muted-foreground text-xs">Comprovante não publicado</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
