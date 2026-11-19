import type { EmendasParlamentar } from '@raio-x/shared';
import { BarrasHorizontais } from '@/components/graficos/barras-horizontais';
import { Indicador } from '@/components/indicador';
import { Paginacao } from '@/components/paginacao';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { SeletorAno } from './seletor-ano';

interface SecaoEmendasProps {
  emendas: EmendasParlamentar;
  hrefAno: (ano: number) => string;
  hrefPagina: (pagina: number) => string;
}

/**
 * Emendas ao orçamento de autoria do parlamentar (Portal da Transparência).
 * "Empenhado" é o valor reservado no orçamento; "pago" é o que já saiu de fato.
 */
export function SecaoEmendas({ emendas, hrefAno, hrefPagina }: SecaoEmendasProps) {
  const { ano } = emendas;
  return (
    <section id="emendas" aria-labelledby="titulo-emendas" className="scroll-mt-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 id="titulo-emendas" className="text-xl font-semibold">
            Emendas parlamentares{ano !== null && ` em ${ano}`}
          </h2>
          <p className="text-muted-foreground max-w-3xl text-sm">
            Recursos do orçamento federal indicados pelo parlamentar. Empenhado é o valor reservado;
            pago é o que já foi transferido. Fonte: Portal da Transparência. A autoria é vinculada
            pelo nome; emendas de bancada não aparecem aqui.
          </p>
        </div>
        {ano !== null && (
          <SeletorAno
            anos={emendas.anosDisponiveis.map((a) => a.ano)}
            selecionado={ano}
            hrefAno={hrefAno}
          />
        )}
      </div>

      {ano === null ? (
        <p className="text-muted-foreground rounded-lg border border-dashed p-8 text-center text-sm">
          Nenhuma emenda individual vinculada a este parlamentar nos anos sincronizados.
        </p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Indicador rotulo="Valor empenhado" valor={formatarMoeda(emendas.totais.empenhado)} />
            <Indicador rotulo="Valor pago" valor={formatarMoeda(emendas.totais.pago)} />
            <Indicador rotulo="Emendas" valor={emendas.totais.quantidade.toLocaleString('pt-BR')} />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>
                  <h3>Por área do orçamento</h3>
                </CardTitle>
                <CardDescription>Valor empenhado por função (saúde, educação…).</CardDescription>
              </CardHeader>
              <CardContent>
                <BarrasHorizontais
                  vazio="Sem valores empenhados."
                  itens={emendas.porFuncao.map((f) => ({
                    chave: f.funcao,
                    rotulo: f.funcao,
                    valor: Number(f.empenhado),
                    detalhe: `pago ${formatarMoeda(f.pago)}`,
                  }))}
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>
                  <h3>Principais destinos</h3>
                </CardTitle>
                <CardDescription>Localidades que mais receberam (valor empenhado).</CardDescription>
              </CardHeader>
              <CardContent>
                <BarrasHorizontais
                  vazio="Sem localidades informadas."
                  itens={emendas.porLocalidade.map((l) => ({
                    chave: l.localidade,
                    rotulo: l.localidade,
                    valor: Number(l.empenhado),
                  }))}
                />
              </CardContent>
            </Card>
          </div>

          <div className="rounded-lg border">
            <Table>
              <TableCaption className="sr-only">
                Emendas de {ano} ({emendas.meta.total} no total)
              </TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Emenda</TableHead>
                  <TableHead>Área</TableHead>
                  <TableHead className="hidden md:table-cell">Destino</TableHead>
                  <TableHead className="text-right">Empenhado</TableHead>
                  <TableHead className="text-right">Pago</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {emendas.data.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell>
                      <span className="block font-medium tabular-nums">{e.codigo}</span>
                      <span
                        className="text-muted-foreground block max-w-64 truncate text-xs"
                        title={e.tipo}
                      >
                        {e.tipo}
                      </span>
                      {e.observacaoAutor && (
                        <span className="text-muted-foreground block max-w-64 text-xs">
                          {e.observacaoAutor}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {e.funcao ?? '—'}
                      {e.subfuncao && (
                        <span className="text-muted-foreground block text-xs">{e.subfuncao}</span>
                      )}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">{e.localidade ?? '—'}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatarMoeda(e.valorEmpenhado)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatarMoeda(e.valorPago)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <Paginacao
            page={emendas.meta.page}
            totalPages={emendas.meta.totalPages}
            hrefPagina={hrefPagina}
          />
        </>
      )}
    </section>
  );
}
