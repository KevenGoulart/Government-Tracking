import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { DeputadosSyncService } from '../sync/deputados-sync.service';
import { DespesasSyncService } from '../sync/despesas-sync.service';
import { EmendasSyncService } from '../sync/emendas-sync.service';
import { SenadoDespesasSyncService } from '../sync/senado-despesas-sync.service';
import { SenadoresSyncService } from '../sync/senadores-sync.service';
import { anosRecentes, despesasJobSchema, JOBS } from '../sync/sync.jobs';
import type { ResultadoSync } from '../sync/sync-run.service';
import { QUEUES } from './queues.module';

/**
 * Consome a fila de sincronização. Concorrência 1: deputados e despesas nunca rodam ao
 * mesmo tempo, o que evita disputa de escrita e respeita o rate limit das fontes.
 */
@Processor(QUEUES.SYNC, { concurrency: 1 })
export class SyncProcessor extends WorkerHost {
  constructor(
    private readonly deputados: DeputadosSyncService,
    private readonly despesas: DespesasSyncService,
    private readonly senadores: SenadoresSyncService,
    private readonly senadoDespesas: SenadoDespesasSyncService,
    private readonly emendas: EmendasSyncService,
  ) {
    super();
  }

  async process(job: Job): Promise<ResultadoSync[]> {
    switch (job.name) {
      case JOBS.DEPUTADOS:
        return [await this.deputados.sincronizar()];
      case JOBS.DESPESAS:
        return this.porAno(job, (ano) => this.despesas.sincronizarAno(ano));
      case JOBS.SENADORES:
        return [await this.senadores.sincronizar()];
      case JOBS.SENADO_DESPESAS:
        return this.porAno(job, (ano) => this.senadoDespesas.sincronizarAno(ano));
      case JOBS.EMENDAS:
        return this.porAno(job, (ano) => this.emendas.sincronizarAno(ano));
      default:
        throw new Error(`Job desconhecido: ${job.name}`);
    }
  }

  /** Processa os anos do job em sequência (padrão: ano anterior e atual). */
  private async porAno(
    job: Job,
    sincronizar: (ano: number) => Promise<ResultadoSync>,
  ): Promise<ResultadoSync[]> {
    const { anos = anosRecentes() } = despesasJobSchema.parse(job.data ?? {});
    const resultados: ResultadoSync[] = [];
    for (const ano of anos) resultados.push(await sincronizar(ano));
    return resultados;
  }
}
