import { parlamentaresQuerySchema } from '@raio-x/shared';
import type { Metadata } from 'next';
import { BuscaParlamentares } from '@/components/busca-parlamentares';
import { Paginacao } from '@/components/paginacao';
import { ParlamentarCard } from '@/components/parlamentar-card';
import { api } from '@/lib/api';
import { hrefCom, lerParams, type SearchParams } from '@/lib/search-params';

export const metadata: Metadata = {
  title: 'Parlamentares',
  description: 'Busque deputados federais por nome, partido ou estado.',
};

export default async function ParlamentaresPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const query = lerParams(parlamentaresQuerySchema, await searchParams);
  const [filtros, resultado] = await Promise.all([
    api.filtros(),
    api.parlamentares({ ...query, casa: 'CAMARA' }),
  ]);
  const { data, meta } = resultado;
  const atuais = { nome: query.nome, partido: query.partido, uf: query.uf };

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Deputados federais</h1>
        <p className="text-muted-foreground">
          Busque por nome (tolera erros de digitação), partido ou estado.
        </p>
      </header>

      {/* key: remonta o formulário quando a URL muda (defaultValue só vale na montagem) */}
      <BuscaParlamentares key={JSON.stringify(atuais)} filtros={filtros} valores={atuais} />

      <section aria-labelledby="resultados" className="space-y-4">
        <h2 id="resultados" className="text-muted-foreground text-sm" aria-live="polite">
          {meta.total === 1
            ? '1 parlamentar encontrado'
            : `${meta.total} parlamentares encontrados`}
        </h2>

        {data.length > 0 ? (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.map((parlamentar) => (
              <ParlamentarCard key={parlamentar.id} parlamentar={parlamentar} />
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground rounded-lg border border-dashed p-8 text-center">
            Nenhum parlamentar encontrado. Tente outro nome ou remova filtros.
          </p>
        )}

        <Paginacao
          page={meta.page}
          totalPages={meta.totalPages}
          hrefPagina={(page) => hrefCom('/parlamentares', atuais, { page })}
        />
      </section>
    </div>
  );
}
