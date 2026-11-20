import { CRITERIOS_PONTOS_ATENCAO, type PontosAtencao } from '@raio-x/shared';
import { ExternalLink, TriangleExclamationPoint } from 'lucide-react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { caixaDeFrase, formatarData, formatarMoeda } from '@/lib/format';
import { hrefFornecedor } from '@/lib/links';
import { cn } from '@/lib/utils';

const percentual = new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 0 });
const vezes = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });

/**
 * Pontos de atenção: valores fora do padrão estatístico, com a regra explicada na própria
 * página. A redação é neutra de propósito: nada aqui indica irregularidade.
 */
export function SecaoPontosAtencao({ pontos }: { pontos: PontosAtencao }) {
  const { valoresAtipicos, concentracao } = pontos;
  const vazio = valoresAtipicos.quantidade === 0 && concentracao === null;
  const c = CRITERIOS_PONTOS_ATENCAO;

  return (
    <section
      id="pontos-de-atencao"
      aria-labelledby="titulo-pontos-atencao"
      className={cn(
        'scroll-mt-4 space-y-4 rounded-xl border-2 p-4 sm:p-6',
        vazio ? 'border-dashed' : 'border-destructive',
      )}
    >
      <div className="space-y-1">
        <h3 id="titulo-pontos-atencao" className="flex items-center gap-2 text-lg font-semibold">
          {!vazio && (
            <TriangleExclamationPoint className="text-destructive size-5 shrink-0" aria-hidden />
          )}
          Pontos de atenção
        </h3>
        <p className="text-muted-foreground max-w-3xl text-sm">
          Valores fora do padrão estatístico, calculados automaticamente a partir dos dados
          oficiais.{' '}
          <strong className="text-foreground font-medium">Não indicam irregularidade</strong>: um
          valor alto pode ter explicação legítima (um evento, um contrato anual pago de uma vez, o
          custo maior de um estado). Servem como ponto de partida para consultar o documento.
        </p>
      </div>

      {vazio ? (
        <p className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">
          Nenhum valor fora do padrão pelos critérios abaixo neste ano.
        </p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          {valoresAtipicos.quantidade > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>
                  <h4>Despesas atípicas para a categoria</h4>
                </CardTitle>
                <CardDescription>
                  {valoresAtipicos.quantidade.toLocaleString('pt-BR')}{' '}
                  {valoresAtipicos.quantidade === 1 ? 'despesa' : 'despesas'}, somando{' '}
                  {formatarMoeda(valoresAtipicos.total)}.
                  {valoresAtipicos.quantidade > valoresAtipicos.data.length &&
                    ` Abaixo, as ${valoresAtipicos.data.length} mais distantes da mediana.`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="divide-y" aria-label="Despesas atípicas">
                  {valoresAtipicos.data.map((d) => (
                    <li key={d.id} className="space-y-1 py-3 text-sm first:pt-0 last:pb-0">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="font-medium">{caixaDeFrase(d.categoria.nome)}</span>
                        <span className="shrink-0 font-semibold tabular-nums">
                          {formatarMoeda(d.valorLiquido)}
                        </span>
                      </div>
                      <p className="text-muted-foreground">
                        {vezes.format(d.vezesMediana)}× a mediana da categoria (
                        {formatarMoeda(d.referencia.mediana)}) · {formatarData(d.dataDocumento)}
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
              </CardContent>
            </Card>
          )}

          {concentracao && (
            <Card className="self-start">
              <CardHeader>
                <CardTitle>
                  <h4>Gastos concentrados em um fornecedor</h4>
                </CardTitle>
                <CardDescription>Sem contar passagens.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p className="text-3xl font-semibold tracking-tight tabular-nums">
                  {percentual.format(concentracao.participacao)}
                </p>
                <p>
                  <Link
                    href={hrefFornecedor(concentracao.fornecedor)}
                    className="font-medium break-words underline-offset-4 hover:underline"
                  >
                    {concentracao.fornecedor.nome}
                  </Link>{' '}
                  recebeu {formatarMoeda(concentracao.total)} de{' '}
                  {formatarMoeda(concentracao.totalBase)} em{' '}
                  {concentracao.quantidade.toLocaleString('pt-BR')}{' '}
                  {concentracao.quantidade === 1 ? 'despesa' : 'despesas'}.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <details className="text-muted-foreground max-w-3xl text-sm">
        <summary className="text-foreground cursor-pointer font-medium">Como é calculado</summary>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            <strong>Despesa atípica:</strong> valor maior que {c.percentil * 100}% das despesas da
            mesma categoria no ano, considerando todos os parlamentares da casa, e acima de Q3 +{' '}
            {c.multiplicadorIqr}×IQR (a regra de Tukey para valores extremos). Categorias com menos
            de {c.minimoDespesasCategoria} despesas no ano e estornos não entram no cálculo.
          </li>
          <li>
            <strong>Concentração:</strong> um único fornecedor com CNPJ ou CPF recebeu{' '}
            {percentual.format(c.participacaoFornecedor)} ou mais do total do ano, sem contar
            passagens (compradas pelos sistemas da própria casa, concentram-se naturalmente em
            poucas companhias aéreas). Só é avaliada a partir de{' '}
            {formatarMoeda(c.totalMinimoConcentracao)} no ano.
          </li>
        </ul>
      </details>
    </section>
  );
}
