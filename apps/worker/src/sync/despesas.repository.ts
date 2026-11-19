import { Injectable } from '@nestjs/common';
import type { Prisma } from '@raio-x/db';
import { normalizarParaBusca } from '@raio-x/shared';
import type { Casa } from '@raio-x/db';
import type { DespesaComChave } from '../comum/despesa-normalizada';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Tamanho dos lotes de `createMany`. O Prisma 7 guarda em cache o plano de cada consulta, e o
 * plano de um `createMany` cresce com o número de linhas: lotes de 5.000 deixavam ~120 MB
 * retidos e o worker passava de 1,4 GB numa sincronização. Lotes pequenos e de tamanho fixo
 * limitam o tamanho e a quantidade de planos diferentes.
 */
const LOTE = 200;

function emLotes<T>(itens: T[], tamanho = LOTE): T[][] {
  const lotes: T[][] = [];
  for (let i = 0; i < itens.length; i += tamanho) lotes.push(itens.slice(i, i + tamanho));
  return lotes;
}

export interface ParlamentarDaCota {
  nome: string;
  uf: string | null;
  partido: string | null;
}

export interface FornecedorDaCota {
  documento: string | null;
  nome: string;
  nomeNormalizado: string;
}

/** Persistência da ingestão de despesas: upserts em lote por chave natural. */
@Injectable()
export class DespesasRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Garante as categorias da casa e retorna o mapa slug → id. */
  async garantirCategorias(
    categorias: Map<string, string>,
    casa: Casa = 'CAMARA',
  ): Promise<Map<string, string>> {
    await this.prisma.categoria.createMany({
      data: [...categorias].map(([slug, nome]) => ({ slug, nome, casa })),
      skipDuplicates: true,
    });
    const salvas = await this.prisma.categoria.findMany({
      where: { slug: { in: [...categorias.keys()] } },
      select: { id: true, slug: true },
    });
    return new Map(salvas.map((c) => [c.slug, c.id]));
  }

  /** Garante os fornecedores (o primeiro nome visto é mantido) e retorna o mapa chave → id. */
  async garantirFornecedores(
    fornecedores: Map<string, FornecedorDaCota>,
  ): Promise<Map<string, string>> {
    const ids = new Map<string, string>();
    for (const lote of emLotes([...fornecedores])) {
      await this.prisma.fornecedor.createMany({
        data: lote.map(([chave, f]) => ({ chave, ...f })),
        skipDuplicates: true,
      });
      const salvos = await this.prisma.fornecedor.findMany({
        where: { chave: { in: lote.map(([chave]) => chave) } },
        select: { id: true, chave: true },
      });
      for (const f of salvos) ids.set(f.chave, f.id);
    }
    return ids;
  }

  /**
   * Garante que todo deputado presente na cota exista. Normalmente já foram criados pela
   * sincronização de deputados; os que faltarem são criados com os dados da própria cota.
   */
  async garantirParlamentares(
    parlamentares: Map<string, ParlamentarDaCota>,
  ): Promise<Map<string, string>> {
    const idsExternos = [...parlamentares.keys()];
    const existentes = await this.prisma.parlamentar.findMany({
      where: { casa: 'CAMARA', idExterno: { in: idsExternos } },
      select: { id: true, idExterno: true },
    });
    const ids = new Map(existentes.map((p) => [p.idExterno, p.id]));

    const faltantes = idsExternos.filter((id) => !ids.has(id));
    if (faltantes.length > 0) {
      await this.prisma.parlamentar.createMany({
        data: faltantes.map((idExterno) => {
          const p = parlamentares.get(idExterno) as ParlamentarDaCota;
          return {
            casa: 'CAMARA' as const,
            idExterno,
            nome: p.nome,
            nomeBusca: normalizarParaBusca(p.nome),
            uf: p.uf ?? 'NA',
            partido: p.partido,
            emExercicio: false,
          };
        }),
        skipDuplicates: true,
      });
      const criados = await this.prisma.parlamentar.findMany({
        where: { casa: 'CAMARA', idExterno: { in: faltantes } },
        select: { id: true, idExterno: true },
      });
      for (const p of criados) ids.set(p.idExterno, p.id);
    }
    return ids;
  }

  /**
   * Substitui as despesas de um parlamentar em um ano pelo conjunto vindo da fonte:
   * insere as novas chaves e remove as que deixaram de existir. Como a chave é derivada do
   * conteúdo, linhas inalteradas não são tocadas e reprocessar não duplica nada.
   */
  async substituirDespesasDoAno(
    parlamentarId: string,
    ano: number,
    despesas: Prisma.DespesaCreateManyInput[],
  ): Promise<{ inseridas: number; removidas: number }> {
    const chaves = despesas.map((d) => d.idExterno);
    return this.prisma.$transaction(async (tx) => {
      const { count: removidas } = await tx.despesa.deleteMany({
        where: { parlamentarId, ano, idExterno: { notIn: chaves } },
      });
      let inseridas = 0;
      for (const lote of emLotes(despesas)) {
        const { count } = await tx.despesa.createMany({ data: lote, skipDuplicates: true });
        inseridas += count;
      }
      return { inseridas, removidas };
    });
  }

  /** Remove despesas do ano de parlamentares da casa que não aparecem mais no arquivo da fonte. */
  async removerDespesasDeAusentes(
    casa: Casa,
    ano: number,
    parlamentarIdsPresentes: string[],
  ): Promise<number> {
    const { count } = await this.prisma.despesa.deleteMany({
      where: {
        ano,
        parlamentar: { casa },
        parlamentarId: { notIn: parlamentarIdsPresentes },
      },
    });
    return count;
  }

  static paraGravacao(
    despesa: DespesaComChave,
    ids: { parlamentarId: string; categoriaId: string; fornecedorId: string | undefined },
  ): Prisma.DespesaCreateManyInput {
    return {
      idExterno: despesa.idExterno,
      parlamentarId: ids.parlamentarId,
      categoriaId: ids.categoriaId,
      fornecedorId: ids.fornecedorId ?? null,
      ano: despesa.ano,
      mes: despesa.mes,
      dataDocumento: despesa.dataDocumento ? new Date(`${despesa.dataDocumento}T00:00:00Z`) : null,
      codDocumento: despesa.codDocumento,
      tipoDocumento: despesa.tipoDocumento,
      numDocumento: despesa.numDocumento,
      passageiro: despesa.passageiro,
      trecho: despesa.trecho,
      valorDocumento: despesa.valorDocumento,
      valorGlosa: despesa.valorGlosa,
      valorLiquido: despesa.valorLiquido,
      urlDocumento: despesa.urlDocumento,
    };
  }
}
