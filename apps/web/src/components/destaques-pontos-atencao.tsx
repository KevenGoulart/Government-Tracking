import { CRITERIOS_PONTOS_ATENCAO, type DestaquesPontosAtencao } from '@raio-x/shared';
import { ExternalLink, TriangleExclamationPoint } from 'lucide-react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { caixaDeFrase, formatarData, formatarMoeda } from '@/lib/format';
import { hrefFornecedor, hrefParlamentar } from '@/lib/links';
import { hrefCom } from '@/lib/search-params';
import { cn } from '@/lib/utils';

const percentual = new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 0 });
const vezes = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });

/** Link para a seção de pontos de atenção do parlamentar, no mesmo ano. */
function hrefPontos(id: string, ano: number) {
  return `${hrefCom(hrefParlamentar(id), {}, { ano })}#pontos-de-atencao`;
}

function Parlamentar({
  parlamentar,
  ano,
}: {
  parlamentar: { id: string; nome: string; partido: string | null; uf: string };
  ano: number;
}) {
  return (
    <span className="min-w-0">
      <Link
        href={hrefPontos(parlamentar.id, ano)}
        className="font-medium break-words underline-offset-4 hover:underline"
      >
        {parlamentar.nome}
      </Link>{' '}
      <span className="text-muted-foreground">
        ({[parlamentar.partido, parlamentar.uf].filter(Boolean).join('-')})
      </span>
    </span>
  );
}

/**
 * Os pontos de atenção mais evidentes da casa no ano, na home. Mesmas regras e mesma
 * redação neutra da página do parlamentar: são valores fora do padrão, não irregularidades.
 */
export function DestaquesPontosAtencao({ destaques }: { destaques: DestaquesPontosAtencao }) {
  const { ano, valoresAtipicos, concentracoes } = destaques;
  if (ano === null) return null;
  const vazio = valoresAtipicos.quantidade === 0 && concentracoes.quantidade === 0;

  return (
    <section
      aria-labelledby="titulo-destaques-pontos"
      className={cn(
        'space-y-4 rounded-xl border-2 p-4 sm:p-6',
        vazio ? 'border-dashed' : 'border-destructive',
      )}
    >
      <div className="space-y-1">
        <h3 id="titulo-destaques-pontos" className="flex items-center gap-2 text-xl font-semibold">
          {!vazio && (
            <TriangleExclamationPoint className="text-destructive size-5 shrink-0" aria-hidden />
          )}
          Principais pontos de atenção
        </h3>
        <p className="text-muted-foreground max-w-3xl text-sm">
          Os valores mais fora do padrão no ano, calculados automaticamente a partir dos dados
          oficiais.{' '}
          <strong className="text-foreground font-medium">Não indicam irregularidade</strong>: um
          valor alto pode ter explicação legítima. Clique no parlamentar para ver os detalhes e como
          cada regra funciona.
        </p>
      </div>

      {vazio ? (
        <p className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">
          Nenhum valor fora do padrão neste ano.
        </p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
          <Card>
            <CardHeader>
              <CardTitle>
                <h4>Despesas mais acima do padrão da categoria</h4>
              </CardTitle>
              <CardDescription>
                {valoresAtipicos.quantidade.toLocaleString('pt-BR')}{' '}
                {valoresAtipicos.quantidade === 1 ? 'despesa atípica' : 'despesas atípicas'} no ano,
                somando {formatarMoeda(valoresAtipicos.total)}.
                {valoresAtipicos.quantidade > valoresAtipicos.data.length &&
                  ` Abaixo, as maiores em reais acima do padrão, uma por parlamentar.`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {valoresAtipicos.data.length === 0 ? (
                <p className="text-muted-foreground text-sm">Nenhuma despesa atípica no ano.</p>
              ) : (
                <ul className="divide-y" aria-label="Despesas mais acima do padrão">
                  {valoresAtipicos.data.map((d) => (
                    <li key={d.id} className="space-y-1 py-3 text-sm first:pt-0 last:pb-0">
                      <div className="flex items-baseline justify-between gap-3">
                        <Parlamentar parlamentar={d.parlamentar} ano={ano} />
                        <span className="shrink-0 font-semibold tabular-nums">
                          {formatarMoeda(d.valorLiquido)}
                        </span>
                      </div>
                      <p>
                        <span className="text-destructive font-semibold">
                          {vezes.format(d.vezesMediana)}× a mediana
                        </span>{' '}
                        <span className="text-muted-foreground">
                          de {caixaDeFrase(d.categoria.nome)} ({formatarMoeda(d.referencia.mediana)}
                          ) · {formatarData(d.dataDocumento)}
                        </span>
                      </p>
                      <div className="text-muted-foreground flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs">
                        {d.fornecedor ? (
                          <Link
                            href={hrefFornecedor(d.fornecedor)}
                            className="break-words underline-offset-4 hover:underline"
                          >
                            {d.fornecedor.nome}
                          </Link>
                        ) : (
                          <span>Fornecedor não informado</span>
                        )}
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
              )}
            </CardContent>
          </Card>

          <Card className="self-start">
            <CardHeader>
              <CardTitle>
                <h4>Gastos concentrados em um fornecedor</h4>
              </CardTitle>
              <CardDescription>
                {concentracoes.quantidade.toLocaleString('pt-BR')}{' '}
                {concentracoes.quantidade === 1 ? 'parlamentar' : 'parlamentares'} com{' '}
                {percentual.format(CRITERIOS_PONTOS_ATENCAO.participacaoFornecedor)} ou mais do
                total do ano em um único fornecedor (sem passagens).
              </CardDescription>
            </CardHeader>
            <CardContent>
              {concentracoes.data.length === 0 ? (
                <p className="text-muted-foreground text-sm">Nenhuma concentração no ano.</p>
              ) : (
                <ul className="divide-y" aria-label="Gastos concentrados em um fornecedor">
                  {concentracoes.data.map((c) => (
                    <li
                      key={c.parlamentar.id}
                      className="space-y-1 py-3 text-sm first:pt-0 last:pb-0"
                    >
                      <div className="flex items-baseline justify-between gap-3">
                        <Parlamentar parlamentar={c.parlamentar} ano={ano} />
                        <span className="text-destructive shrink-0 font-semibold tabular-nums">
                          {percentual.format(c.participacao)}
                        </span>
                      </div>
                      <p className="text-muted-foreground">
                        <Link
                          href={hrefFornecedor(c.fornecedor)}
                          className="break-words underline-offset-4 hover:underline"
                        >
                          {c.fornecedor.nome}
                        </Link>{' '}
                        recebeu {formatarMoeda(c.total)} de {formatarMoeda(c.totalBase)}.
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </section>
  );
}
