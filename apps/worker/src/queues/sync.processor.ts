import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { DeputadosSyncService } from '../sync/deputados-sync.service';
import { DespesasSyncService } from '../sync/despesas-sync.service';
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
  ) {
    super();
  }

  async process(job: Job): Promise<ResultadoSync[]> {
    switch (job.name) {
      case JOBS.DEPUTADOS:
        return [await this.deputados.sincronizar()];
      case JOBS.DESPESAS: {
        const { anos = anosRecentes() } = despesasJobSchema.parse(job.data ?? {});
        const resultados: ResultadoSync[] = [];
        for (const ano of anos) resultados.push(await this.despesas.sincronizarAno(ano));
        return resultados;
      }
      default:
        throw new Error(`Job desconhecido: ${job.name}`);
    }
  }
}
