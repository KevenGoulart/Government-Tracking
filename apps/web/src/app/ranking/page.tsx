import { rankingQuerySchema } from '@raio-x/shared';
import type { Metadata } from 'next';
import { CampoSelect } from '@/components/campo-select';
import { Paginacao } from '@/components/paginacao';
import { TabelaRanking } from '@/components/ranking/tabela-ranking';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { caixaDeFrase } from '@/lib/format';
import { hrefCom, lerParams, type SearchParams } from '@/lib/search-params';

export const metadata: Metadata = {
  title: 'Ranking de gastos',
  description: 'Total gasto com a cota parlamentar por deputado federal, com filtros.',
};

export default async function RankingPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const query = lerParams(rankingQuerySchema, await searchParams);
  const [ranking, estatisticas, categorias, filtros] = await Promise.all([
    api.ranking(query),
    api.estatisticas(),
    api.categorias(),
    api.filtros(),
  ]);
  const ano = ranking.ano;
  const atuais = {
    ano: ano ?? undefined,
    categoria: query.categoria,
    partido: query.partido,
    uf: query.uf,
  };
  const categoriaAtual = categorias.find((c) => c.slug === query.categoria);

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Ranking de gastos</h1>
        <p className="text-muted-foreground max-w-3xl">
          Total gasto com a cota parlamentar por deputado no ano, do maior para o menor. Um total
          alto não indica irregularidade: o valor máximo da cota varia conforme o estado do
          deputado, e partido e UF são os atuais.
        </p>
      </header>

      {/* key: remonta o formulário quando a URL muda (defaultValue só vale na montagem) */}
      <form
        key={JSON.stringify(atuais)}
        action="/ranking"
        method="get"
        aria-label="Filtrar ranking"
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[7rem_1fr_9rem_7rem_auto] lg:items-end"
      >
        <div className="space-y-1.5">
          <label htmlFor="ano" className="text-sm font-medium">
            Ano
          </label>
          <CampoSelect id="ano" name="ano" defaultValue={ano ?? ''}>
            {estatisticas.anosDisponiveis.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </CampoSelect>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="categoria" className="text-sm font-medium">
            Categoria
          </label>
          <CampoSelect id="categoria" name="categoria" defaultValue={query.categoria ?? ''}>
            <option value="">Todas</option>
            {categorias.map((c) => (
              <option key={c.slug} value={c.slug}>
                {caixaDeFrase(c.nome)}
              </option>
            ))}
          </CampoSelect>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="partido" className="text-sm font-medium">
            Partido
          </label>
          <CampoSelect id="partido" name="partido" defaultValue={query.partido ?? ''}>
            <option value="">Todos</option>
            {filtros.partidos.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </CampoSelect>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="uf" className="text-sm font-medium">
            UF
          </label>
          <CampoSelect id="uf" name="uf" defaultValue={query.uf ?? ''}>
            <option value="">Todas</option>
            {filtros.ufs.map((uf) => (
              <option key={uf} value={uf}>
                {uf}
              </option>
            ))}
          </CampoSelect>
        </div>
        <Button type="submit">Aplicar</Button>
      </form>

      <section aria-labelledby="titulo-ranking" className="space-y-4">
        <h2 id="titulo-ranking" className="text-muted-foreground text-sm" aria-live="polite">
          {ranking.meta.total.toLocaleString('pt-BR')} deputados com despesas em {ano}
          {categoriaAtual && ` na categoria ${caixaDeFrase(categoriaAtual.nome)}`}
        </h2>
        <TabelaRanking itens={ranking.data} legenda={`Ranking de gastos de ${ano}`} />
        <Paginacao
          page={ranking.meta.page}
          totalPages={ranking.meta.totalPages}
          hrefPagina={(page) => hrefCom('/ranking', atuais, { page })}
        />
      </section>
    </div>
  );
}
