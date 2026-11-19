import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@raio-x/db';
import { FONTES_SYNC } from '@raio-x/shared';
import { IndiceNomes } from '../comum/indice-nomes';
import { PrismaService } from '../prisma/prisma.service';
import { type EmendaNormalizada, mapearEmenda } from '../transparencia/emenda.mapper';
import type { PortalTransparenciaClient } from '../transparencia/portal-transparencia.client';
import { PORTAL_TRANSPARENCIA } from '../transparencia/transparencia.module';
import { type ResultadoSync, SyncRunService } from './sync-run.service';

// Lotes pequenos: o Prisma guarda o plano de cada createMany (ver despesas.repository.ts)
const LOTE = 200;
const MAX_NOMES_DETALHE = 20;

/**
 * Sincroniza as emendas parlamentares de um ano (Portal da Transparência).
 *
 * Os valores (empenhado, liquidado, pago) são acumulados e mudam ao longo do tempo, e a
 * fonte é consultada inteira a cada execução: o ano é substituído numa transação.
 * O autor vem só pelo nome; o vínculo usa o mesmo índice de nomes do Senado, sobre
 * deputados e senadores. Bancadas, comissões e nomes sem correspondência única ficam
 * sem vínculo (e contabilizados no SyncRun).
 */
@Injectable()
export class EmendasSyncService {
  private readonly logger = new Logger(EmendasSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly syncRun: SyncRunService,
    @Inject(PORTAL_TRANSPARENCIA) private readonly portal: PortalTransparenciaClient | null,
  ) {}

  /** Só é possível sincronizar emendas com a chave da API configurada. */
  get habilitado(): boolean {
    return this.portal !== null;
  }

  sincronizarAno(ano: number): Promise<ResultadoSync> {
    return this.syncRun.executar(FONTES_SYNC.TRANSPARENCIA_EMENDAS, { ano }, () =>
      this.executar(ano),
    );
  }

  private async executar(ano: number): Promise<ResultadoSync> {
    if (!this.portal) {
      throw new Error('TRANSPARENCIA_API_KEY não configurada: emendas não podem ser sincronizadas');
    }

    const emendas: EmendaNormalizada[] = [];
    for await (const pagina of this.portal.listarEmendas(ano))
      emendas.push(...pagina.map(mapearEmenda));
    if (emendas.length === 0) throw new Error(`Portal não retornou emendas de ${ano}`);

    const parlamentares = await this.prisma.parlamentar.findMany({
      select: { id: true, nome: true, nomeCivil: true },
    });
    const indice = new IndiceNomes(parlamentares);

    let vinculadas = 0;
    let coletivas = 0;
    const semVinculo = new Map<string, { motivo: string; emendas: number }>();
    const registros: Prisma.EmendaCreateManyInput[] = emendas.map((e) => {
      let parlamentarId: string | null = null;
      if (e.autorColetivo) {
        coletivas++;
      } else {
        const resultado = indice.resolver(e.autor);
        if (resultado.status === 'encontrado') {
          parlamentarId = resultado.id;
          vinculadas++;
        } else {
          const atual = semVinculo.get(e.autor) ?? { motivo: resultado.status, emendas: 0 };
          semVinculo.set(e.autor, { ...atual, emendas: atual.emendas + 1 });
        }
      }
      const { autorColetivo: _coletivo, ...dados } = e;
      return { ...dados, parlamentarId };
    });

    const codigos = new Set(registros.map((r) => r.codigo));
    if (codigos.size !== registros.length) {
      throw new Error(
        `Emendas de ${ano}: códigos repetidos na fonte (${registros.length - codigos.size})`,
      );
    }

    await this.prisma.$transaction(
      async (tx) => {
        await tx.emenda.deleteMany({ where: { ano } });
        for (let i = 0; i < registros.length; i += LOTE) {
          await tx.emenda.createMany({ data: registros.slice(i, i + LOTE) });
        }
      },
      { timeout: 60_000 },
    );

    const naoVinculadas = [...semVinculo].reduce((soma, [, v]) => soma + v.emendas, 0);
    this.logger.log(
      `Emendas ${ano}: ${registros.length} (${vinculadas} vinculadas, ${coletivas} de bancada/comissão, ` +
        `${naoVinculadas} sem vínculo)`,
    );
    return {
      processados: registros.length,
      detalhes: {
        vinculadas,
        coletivas,
        semVinculo: naoVinculadas,
        autoresSemVinculo: [...semVinculo]
          .sort(([, a], [, b]) => b.emendas - a.emendas)
          .slice(0, MAX_NOMES_DETALHE)
          .map(([autor, v]) => ({ autor, ...v })),
      },
    };
  }
}
