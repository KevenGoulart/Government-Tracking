import {
  type Comparacao,
  MAX_COMPARACAO,
  MIN_COMPARACAO,
  type ParlamentarResumo,
} from '@raio-x/shared';
import { X } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { idsDaUrl, montarCategorias, montarMensal } from '@/components/comparacao/dados';
import {
  ComparacaoCategoriasChart,
  ComparacaoMensalChart,
} from '@/components/comparacao/graficos-comparacao';
import { Legenda } from '@/components/comparacao/legenda';
import { CORES_SERIES, type Serie } from '@/components/comparacao/series';
import { FotoParlamentar } from '@/components/foto-parlamentar';
import { AvisoAnoEmAndamento } from '@/components/parlamentar/gastos-mensais';
import { SeletorAno } from '@/components/parlamentar/seletor-ano';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { api, ApiError } from '@/lib/api';
import { formatarMoeda, nomeMes } from '@/lib/format';
import { hrefParlamentar } from '@/lib/links';
import { achatar, hrefCom, type SearchParams } from '@/lib/search-params';

export const metadata: Metadata = {
  title: 'Comparar parlamentares',
  description: 'Compare lado a lado os gastos da cota parlamentar de 2 a 4 deputados federais.',
};

function hrefIds(ids: string[], ano?: number): string {
  return hrefCom('/comparar', {}, { ids: ids.join(',') || undefined, ano });
}

async function carregarComparacao(ids: string[], ano?: number): Promise<Comparacao | null> {
  try {
    return await api.comparacao(ids, ano);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

export default async function CompararPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = achatar(await searchParams);
  const ids = idsDaUrl(params.ids);
  const anoPedido = Number(params.ano) || undefined;
  const nome = params.nome?.trim();

  const [comparacao, selecionadosAvulsos, busca, estatisticas] = await Promise.all([
    ids.length >= MIN_COMPARACAO ? carregarComparacao(ids, anoPedido) : null,
    // Com menos de 2 selecionados não há comparação; busca só os dados para exibir.
    ids.length < MIN_COMPARACAO
      ? Promise.all(ids.map((id) => api.parlamentar(id).catch(() => null)))
      : [],
    nome && nome.length >= 2 ? api.parlamentares({ nome, pageSize: 8 }) : null,
    api.estatisticas(),
  ]);

  const selecionados: ParlamentarResumo[] = comparacao
    ? comparacao.parlamentares.map((p) => p.parlamentar)
    : selecionadosAvulsos.flatMap((p) => (p ? [p] : []));
  const series: Serie[] = selecionados.map((p, i) => ({
    id: p.id,
    nome: p.nome,
    cor: CORES_SERIES[i] ?? CORES_SERIES[0],
  }));
  const ano = comparacao?.ano ?? null;
  const cheio = ids.length >= MAX_COMPARACAO;

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Comparar parlamentares</h1>
        <p className="text-muted-foreground">
          Escolha de {MIN_COMPARACAO} a {MAX_COMPARACAO} deputados para comparar os gastos da cota
          no mesmo ano.
        </p>
      </header>

      <section aria-labelledby="titulo-selecionados" className="space-y-3">
        <h2 id="titulo-selecionados" className="text-sm font-medium">
          Selecionados ({selecionados.length} de {MAX_COMPARACAO})
        </h2>
        {selecionados.length > 0 ? (
          <ul className="flex flex-wrap gap-2">
            {selecionados.map((p, i) => (
              <li key={p.id} className="flex items-center gap-2 rounded-full border py-1 pr-1 pl-1">
                <FotoParlamentar nome={p.nome} fotoUrl={p.fotoUrl} tamanho={28} />
                <span
                  aria-hidden
                  className="size-2.5 rounded-sm"
                  style={{ backgroundColor: series[i]?.cor }}
                />
                <Link href={hrefParlamentar(p.id)} className="text-sm font-medium hover:underline">
                  {p.nome}
                </Link>
                <Link
                  href={hrefIds(
                    ids.filter((id) => id !== p.id),
                    anoPedido,
                  )}
                  className="hover:bg-muted rounded-full p-1"
                  aria-label={`Remover ${p.nome} da comparação`}
                >
                  <X className="size-4" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground text-sm">Nenhum parlamentar selecionado ainda.</p>
        )}
      </section>

      {!cheio && (
        <section aria-labelledby="titulo-adicionar" className="space-y-3">
          <h2 id="titulo-adicionar" className="text-sm font-medium">
            Adicionar parlamentar
          </h2>
          <form
            action="/comparar"
            method="get"
            role="search"
            aria-label="Buscar parlamentar para comparar"
            className="flex max-w-xl gap-2"
          >
            {ids.length > 0 && <input type="hidden" name="ids" value={ids.join(',')} />}
            {anoPedido && <input type="hidden" name="ano" value={anoPedido} />}
            <label htmlFor="nome" className="sr-only">
              Nome do parlamentar
            </label>
            <Input
              id="nome"
              name="nome"
              type="search"
              placeholder="Nome do parlamentar"
              defaultValue={nome}
              minLength={2}
              autoComplete="off"
            />
            <Button type="submit" variant="outline">
              Buscar
            </Button>
          </form>
          {busca && (
            <ul className="divide-y rounded-lg border" aria-label="Resultados da busca">
              {busca.data.length === 0 && (
                <li className="text-muted-foreground p-3 text-sm">
                  Nenhum parlamentar encontrado.
                </li>
              )}
              {busca.data.map((p) => {
                const jaSelecionado = ids.includes(p.id);
                return (
                  <li key={p.id} className="flex items-center gap-3 p-3">
                    <FotoParlamentar nome={p.nome} fotoUrl={p.fotoUrl} tamanho={32} />
                    <span className="flex-1 text-sm">
                      <span className="font-medium">{p.nome}</span>{' '}
                      <span className="text-muted-foreground">
                        {[p.partido, p.uf].filter(Boolean).join(' · ')}
                      </span>
                    </span>
                    {jaSelecionado ? (
                      <span className="text-muted-foreground text-sm">Selecionado</span>
                    ) : (
                      <Button size="sm" variant="secondary" asChild>
                        <Link
                          href={hrefIds([...ids, p.id], anoPedido)}
                          aria-label={`Adicionar ${p.nome}`}
                        >
                          Adicionar
                        </Link>
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {ids.length >= MIN_COMPARACAO && !comparacao && (
        <p role="alert" className="text-destructive text-sm">
          Algum dos parlamentares do link não foi encontrado. Remova-o e tente novamente.
        </p>
      )}

      {comparacao && ano !== null && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h2 className="text-xl font-semibold">Comparação em {ano}</h2>
            <SeletorAno
              anos={estatisticas.anosDisponiveis}
              selecionado={ano}
              hrefAno={(novoAno) => hrefIds(ids, novoAno)}
            />
          </div>

          {/* Tabela visível: valores exatos e alternativa acessível aos gráficos */}
          <div className="rounded-lg border">
            <Table>
              <TableCaption className="sr-only">Resumo da comparação em {ano}</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Parlamentar</TableHead>
                  <TableHead className="text-right">Total (valor líquido)</TableHead>
                  <TableHead className="text-right">Despesas</TableHead>
                  <TableHead className="hidden text-right sm:table-cell">Maior categoria</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {comparacao.parlamentares.map((p, i) => (
                  <TableRow key={p.parlamentar.id}>
                    <TableCell>
                      <span className="flex items-center gap-2 font-medium">
                        <span
                          aria-hidden
                          className="size-3 shrink-0 rounded-sm"
                          style={{ backgroundColor: series[i]?.cor }}
                        />
                        {p.parlamentar.nome}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {formatarMoeda(p.total)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {p.quantidade.toLocaleString('pt-BR')}
                    </TableCell>
                    <TableCell className="text-muted-foreground hidden text-right sm:table-cell">
                      {p.categorias[0]
                        ? montarCategorias({ ...comparacao, parlamentares: [p] }, 1)[0]?.rotulo
                        : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <Legenda series={series} />

          <Card>
            <CardHeader>
              <CardTitle>
                <h3>Evolução mensal</h3>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <TabelaGrafico
                titulo={`Gasto mensal em ${ano}`}
                linhas={montarMensal(comparacao)}
                series={series}
                rotulo={(mes) => nomeMes(Number(mes))}
              >
                <ComparacaoMensalChart dados={montarMensal(comparacao)} series={series} />
              </TabelaGrafico>
              {ano === new Date().getFullYear() && (
                <p className="text-muted-foreground mt-2 text-xs">
                  <AvisoAnoEmAndamento />
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>
                <h3>Principais categorias</h3>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <TabelaGrafico
                titulo={`Gasto por categoria em ${ano}`}
                linhas={montarCategorias(comparacao)}
                series={series}
                rotulo={(r) => r}
              >
                <ComparacaoCategoriasChart dados={montarCategorias(comparacao)} series={series} />
              </TabelaGrafico>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

/** Gráfico com a tabela equivalente acessível a leitores de tela. */
function TabelaGrafico({
  titulo,
  linhas,
  series,
  rotulo,
  children,
}: {
  titulo: string;
  linhas: ReturnType<typeof montarMensal>;
  series: Serie[];
  rotulo: (valor: string) => string;
  children: React.ReactNode;
}) {
  return (
    <figure>
      {children}
      <table className="sr-only">
        <caption>{titulo}</caption>
        <thead>
          <tr>
            <th scope="col">Período/categoria</th>
            {series.map((s) => (
              <th key={s.id} scope="col">
                {s.nome}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {linhas.map((linha) => (
            <tr key={linha.rotulo}>
              <th scope="row">{rotulo(linha.rotulo)}</th>
              {series.map((s) => (
                <td key={s.id}>{formatarMoeda(Number(linha[s.id] ?? 0))}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
