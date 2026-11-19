import { fornecedorQuerySchema } from '@raio-x/shared';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Indicador } from '@/components/indicador';
import { GastosPorCategoria } from '@/components/parlamentar/gastos-por-categoria';
import { TabelaRanking } from '@/components/ranking/tabela-ranking';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { api, ApiError } from '@/lib/api';
import { formatarDocumento, formatarMoeda } from '@/lib/format';
import { hrefCom, lerParams, type SearchParams } from '@/lib/search-params';
import { cn } from '@/lib/utils';

/** Linhas exibidas antes do "ver mais". */
const VISIVEIS = 20;

interface Props {
  params: Promise<{ documento: string }>;
  searchParams: Promise<SearchParams>;
}

async function carregar(documento: string, ano?: number) {
  try {
    return await api.fornecedor(documento, ano);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { documento } = await params;
  const fornecedor = await carregar(decodeURIComponent(documento));
  return {
    title: fornecedor.nome,
    description: `Pagamentos da cota parlamentar a ${fornecedor.nome}, com dados oficiais da Câmara dos Deputados.`,
  };
}

export default async function FornecedorPage({ params, searchParams }: Props) {
  const documento = decodeURIComponent((await params).documento);
  const { ano } = lerParams(fornecedorQuerySchema, await searchParams);
  const fornecedor = await carregar(documento, ano);
  const base = `/fornecedores/${encodeURIComponent(documento)}`;
  const periodo = ano ? `em ${ano}` : 'nos anos sincronizados';
  const itens = fornecedor.parlamentares.map((p, i) => ({ posicao: i + 1, ...p }));

  const opcoesPeriodo = [
    { rotulo: 'Todos os anos', href: base, ativo: ano === undefined },
    ...fornecedor.anosDisponiveis.map((a) => ({
      rotulo: String(a.ano),
      href: hrefCom(base, {}, { ano: a.ano }),
      ativo: a.ano === ano,
    })),
  ];

  return (
    <article className="space-y-8">
      <header className="space-y-2">
        <p className="text-muted-foreground text-sm">Fornecedor</p>
        <h1 className="text-3xl font-bold tracking-tight break-words">{fornecedor.nome}</h1>
        <p className="text-muted-foreground tabular-nums">
          {fornecedor.documento && fornecedor.tipoDocumento
            ? `${fornecedor.tipoDocumento} ${formatarDocumento(fornecedor.documento)}`
            : 'Sem CNPJ/CPF válido na fonte oficial (identificado pelo nome)'}
        </p>
      </header>

      <nav aria-label="Período" className="bg-muted inline-flex flex-wrap rounded-lg p-1">
        {opcoesPeriodo.map((opcao) => (
          <Link
            key={opcao.rotulo}
            href={opcao.href}
            aria-current={opcao.ativo ? 'page' : undefined}
            className={cn(
              'focus-visible:ring-ring/50 rounded-md px-3 py-1 text-sm font-medium tabular-nums outline-none focus-visible:ring-3',
              opcao.ativo
                ? 'bg-background shadow-sm'
                : 'text-secondary-foreground hover:bg-background/60',
            )}
          >
            {opcao.rotulo}
          </Link>
        ))}
      </nav>

      <div className="grid gap-4 sm:grid-cols-3">
        <Indicador rotulo={`Recebido ${periodo}`} valor={formatarMoeda(fornecedor.total)} />
        <Indicador rotulo="Despesas" valor={fornecedor.quantidade.toLocaleString('pt-BR')} />
        <Indicador
          rotulo="Deputados que pagaram"
          valor={fornecedor.quantidadeParlamentares.toLocaleString('pt-BR')}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <section aria-labelledby="titulo-pagadores" className="space-y-3">
          <h2 id="titulo-pagadores" className="text-lg font-semibold">
            Deputados que pagaram este fornecedor
          </h2>
          {fornecedor.quantidadeParlamentares > fornecedor.parlamentares.length && (
            <p className="text-muted-foreground text-sm">
              Mostrando os {fornecedor.parlamentares.length} que mais pagaram, de{' '}
              {fornecedor.quantidadeParlamentares}.
            </p>
          )}
          <TabelaRanking
            legenda={`Deputados que pagaram ${fornecedor.nome} ${periodo}`}
            itens={itens.slice(0, VISIVEIS)}
          />
          {itens.length > VISIVEIS && (
            <details className="group space-y-3">
              <summary className="text-primary cursor-pointer text-sm underline-offset-4 hover:underline">
                Ver os outros {itens.length - VISIVEIS}
              </summary>
              <TabelaRanking
                legenda={`Demais deputados que pagaram ${fornecedor.nome} ${periodo}`}
                itens={itens.slice(VISIVEIS)}
              />
            </details>
          )}
        </section>
        <Card className="self-start">
          <CardHeader>
            <CardTitle>
              <h2>Categorias</h2>
            </CardTitle>
            <CardDescription>Em que tipo de despesa os pagamentos foram lançados.</CardDescription>
          </CardHeader>
          <CardContent>
            <GastosPorCategoria categorias={fornecedor.categorias} />
          </CardContent>
        </Card>
      </div>
    </article>
  );
}
