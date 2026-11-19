import { despesasQuerySchema, parlamentarDetalheQuerySchema } from '@raio-x/shared';
import { ExternalLink } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { FotoParlamentar } from '@/components/foto-parlamentar';
import { Indicador } from '@/components/indicador';
import { Paginacao } from '@/components/paginacao';
import { GastosMensais } from '@/components/parlamentar/gastos-mensais';
import { GastosPorCategoria } from '@/components/parlamentar/gastos-por-categoria';
import { MaioresFornecedores } from '@/components/parlamentar/maiores-fornecedores';
import { SeletorAno } from '@/components/parlamentar/seletor-ano';
import { FiltrosDespesas, TabelaDespesas } from '@/components/parlamentar/tabela-despesas';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { api, ApiError } from '@/lib/api';
import { formatarMoeda } from '@/lib/format';
import { achatar, hrefCom, lerParams, type SearchParams } from '@/lib/search-params';

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
}

const ORDENACOES = {
  'data-desc': { ordenarPor: 'data', ordem: 'desc' },
  'data-asc': { ordenarPor: 'data', ordem: 'asc' },
  'valor-desc': { ordenarPor: 'valor', ordem: 'desc' },
  'valor-asc': { ordenarPor: 'valor', ordem: 'asc' },
} as const;

async function carregarParlamentar(id: string, ano?: number) {
  try {
    return await api.parlamentar(id, ano);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const parlamentar = await carregarParlamentar(id);
  const descricao = [parlamentar.partido, parlamentar.uf].filter(Boolean).join('-');
  return {
    title: parlamentar.nome,
    description: `Gastos da cota parlamentar de ${parlamentar.nome} (${descricao}), com dados oficiais da Câmara dos Deputados.`,
  };
}

export default async function ParlamentarPage({ params, searchParams }: Props) {
  const { id } = await params;
  const brutos = achatar(await searchParams);
  const { ano: anoPedido } = lerParams(parlamentarDetalheQuerySchema, brutos);

  const parlamentar = await carregarParlamentar(id, anoPedido);
  const { resumo } = parlamentar;
  const ano = resumo.anoReferencia;

  const ordenacao =
    brutos.ordenacao && brutos.ordenacao in ORDENACOES
      ? (brutos.ordenacao as keyof typeof ORDENACOES)
      : undefined;
  const filtros = lerParams(despesasQuerySchema, {
    ...brutos,
    ...(ordenacao && ORDENACOES[ordenacao]),
  });

  const [gastos, despesas, categorias] = ano
    ? await Promise.all([
        api.gastosMensais(id, ano),
        api.despesas(id, { ...filtros, ano }),
        api.categorias(),
      ])
    : [[], null, []];

  const base = `/parlamentares/${id}`;
  const filtrosAtuais = {
    ano: ano ?? undefined,
    mes: filtros.mes,
    categoria: filtros.categoria,
    ordenacao: `${filtros.ordenarPor}-${filtros.ordem}`,
  };
  const quantidadeAno = resumo.anosDisponiveis.find((a) => a.ano === ano)?.quantidade ?? 0;

  return (
    <article className="space-y-8">
      <header className="flex flex-col gap-6 sm:flex-row sm:items-center">
        <FotoParlamentar
          nome={parlamentar.nome}
          fotoUrl={parlamentar.fotoUrl}
          tamanho={112}
          prioridade
        />
        <div className="flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">{parlamentar.nome}</h1>
            <Badge variant={parlamentar.emExercicio ? 'secondary' : 'outline'}>
              {parlamentar.emExercicio ? 'Em exercício' : 'Fora de exercício'}
            </Badge>
          </div>
          <p className="text-muted-foreground">
            Deputado(a) federal ·{' '}
            {[parlamentar.partido, parlamentar.uf].filter(Boolean).join(' · ')}
            {parlamentar.nomeCivil && <> · Nome civil: {parlamentar.nomeCivil}</>}
          </p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <Link
              href={`/comparar?ids=${parlamentar.id}`}
              className="text-primary text-sm underline-offset-4 hover:underline"
            >
              Comparar com outros parlamentares
            </Link>
            <a
              href={`https://www.camara.leg.br/deputados/${parlamentar.idExterno}`}
              target="_blank"
              rel="noreferrer"
              className="text-primary inline-flex items-center gap-1 text-sm underline-offset-4 hover:underline"
            >
              Perfil na Câmara dos Deputados <ExternalLink className="size-3.5" aria-hidden />
              <span className="sr-only">(abre em nova aba)</span>
            </a>
          </div>
        </div>
      </header>

      {ano === null ? (
        <p className="text-muted-foreground rounded-lg border border-dashed p-8 text-center">
          Não há despesas da cota parlamentar registradas para este parlamentar nos anos
          sincronizados.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h2 className="text-xl font-semibold">Cota parlamentar em {ano}</h2>
            <SeletorAno
              anos={resumo.anosDisponiveis.map((a) => a.ano)}
              selecionado={ano}
              hrefAno={(novoAno) => hrefCom(base, {}, { ano: novoAno })}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Indicador
              rotulo="Total gasto (valor líquido)"
              valor={formatarMoeda(resumo.totalAno)}
            />
            <Indicador
              rotulo="Despesas registradas"
              valor={quantidadeAno.toLocaleString('pt-BR')}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>
                <h3>Evolução mensal</h3>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <GastosMensais gastos={gastos} ano={ano} />
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>
                  <h3>Gastos por categoria</h3>
                </CardTitle>
                <CardDescription>Clique em uma categoria para ver as despesas.</CardDescription>
              </CardHeader>
              <CardContent>
                <GastosPorCategoria
                  categorias={resumo.categorias}
                  hrefCategoria={(categoria) => `${hrefCom(base, { ano }, { categoria })}#despesas`}
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>
                  <h3>Maiores fornecedores</h3>
                </CardTitle>
                <CardDescription>Os 10 que mais receberam no ano.</CardDescription>
              </CardHeader>
              <CardContent>
                <MaioresFornecedores fornecedores={resumo.fornecedores} />
              </CardContent>
            </Card>
          </div>

          <section
            id="despesas"
            aria-labelledby="titulo-despesas"
            className="scroll-mt-4 space-y-4"
          >
            <div className="space-y-1">
              <h3 id="titulo-despesas" className="text-lg font-semibold">
                Despesas
              </h3>
              <p className="text-muted-foreground text-sm">
                Valor líquido = valor do documento menos glosa. Estornos aparecem com valor
                negativo. O filtro de mês usa o mês de competência, que pode diferir da data do
                documento.
              </p>
            </div>
            {/* key: remonta o formulário quando a URL muda (defaultValue só vale na montagem) */}
            <FiltrosDespesas
              key={JSON.stringify(filtrosAtuais)}
              acao={base}
              ano={ano}
              categorias={categorias}
              valores={filtros}
            />
            {despesas && (
              <>
                <TabelaDespesas despesas={despesas.data} total={despesas.meta.total} />
                <Paginacao
                  page={despesas.meta.page}
                  totalPages={despesas.meta.totalPages}
                  hrefPagina={(page) => `${hrefCom(base, filtrosAtuais, { page })}#despesas`}
                />
              </>
            )}
          </section>
        </>
      )}
    </article>
  );
}
