import { estatisticasQuerySchema } from '@raio-x/shared';
import Link from 'next/link';
import { BarrasHorizontais } from '@/components/graficos/barras-horizontais';
import { Indicador } from '@/components/indicador';
import { GastosPorCategoria } from '@/components/parlamentar/gastos-por-categoria';
import { SeletorAno } from '@/components/parlamentar/seletor-ano';
import { TabelaRanking } from '@/components/ranking/tabela-ranking';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api';
import { formatarMoeda, formatarMoedaCompacta } from '@/lib/format';
import { hrefCom, lerParams, type SearchParams } from '@/lib/search-params';

export default async function HomePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { ano: anoPedido } = lerParams(estatisticasQuerySchema, await searchParams);
  const est = await api.estatisticas(anoPedido);
  const { ano } = est;

  return (
    <div className="space-y-10">
      <section className="space-y-4 py-6 text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Raio-X Público</h1>
        <p className="text-muted-foreground mx-auto max-w-2xl text-lg">
          Veja como deputados federais usam a Cota para o Exercício da Atividade Parlamentar (CEAP),
          com dados abertos oficiais da Câmara dos Deputados.
        </p>
        <Button size="lg" asChild>
          <Link href="/parlamentares">Buscar parlamentares</Link>
        </Button>
      </section>

      {ano === null ? (
        <p className="text-muted-foreground rounded-lg border border-dashed p-8 text-center">
          Ainda não há despesas sincronizadas.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h2 className="text-2xl font-semibold">Cota parlamentar em {ano}</h2>
            <SeletorAno
              anos={est.anosDisponiveis}
              selecionado={ano}
              hrefAno={(novoAno) => hrefCom('/', {}, { ano: novoAno })}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Indicador rotulo="Total gasto (valor líquido)" valor={formatarMoeda(est.total)} />
            <Indicador
              rotulo="Despesas registradas"
              valor={est.quantidadeDespesas.toLocaleString('pt-BR')}
            />
            <Indicador
              rotulo="Deputados com despesas"
              valor={est.quantidadeParlamentares.toLocaleString('pt-BR')}
            />
            <Indicador
              rotulo="Fornecedores pagos"
              valor={est.quantidadeFornecedores.toLocaleString('pt-BR')}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>
                  <h3>Gastos por categoria</h3>
                </CardTitle>
                <CardDescription>
                  Clique para ver quem mais gastou em cada categoria.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <GastosPorCategoria
                  categorias={est.porCategoria}
                  hrefCategoria={(categoria) => hrefCom('/ranking', { ano }, { categoria })}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>
                  <h3>Maiores totais do ano</h3>
                </CardTitle>
                <CardDescription>
                  Um total alto não indica irregularidade: o limite da cota varia por estado.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <TabelaRanking itens={est.maioresGastos} legenda={`Maiores totais de ${ano}`} />
                <Link
                  href={hrefCom('/ranking', {}, { ano })}
                  className="text-primary text-sm underline-offset-4 hover:underline"
                >
                  Ver ranking completo
                </Link>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>
                <h3>Gastos por estado</h3>
              </CardTitle>
              <CardDescription>
                Total por estado do deputado, com a média por deputado (as bancadas têm tamanhos
                diferentes).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <BarrasHorizontais
                vazio="Nenhuma despesa no período."
                itens={est.porUf.map((u) => ({
                  chave: u.uf,
                  rotulo: u.uf,
                  valor: Number(u.total),
                  detalhe: `${u.parlamentares} deputados · média ${formatarMoedaCompacta(u.mediaPorParlamentar)}`,
                  href: hrefCom('/ranking', { ano }, { uf: u.uf }),
                }))}
              />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
