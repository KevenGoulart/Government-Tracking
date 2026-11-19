import { InjectQueue } from '@nestjs/bullmq';
import { Inject, Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { Queue } from 'bullmq';
import { APP_CONFIG, type AppConfig } from '../config/config.module';
import { JOBS } from '../sync/sync.jobs';
import { QUEUES } from './queues.module';

const TZ = 'America/Sao_Paulo';

/** Agendamentos (cron) registrados no Redis. `upsertJobScheduler` é idempotente. */
export const AGENDAMENTOS = [
  // Segunda-feira às 04:00: lista de deputados muda pouco (posses, licenças, trocas de partido)
  { id: 'camara-deputados', pattern: '0 0 4 * * 1', job: JOBS.DEPUTADOS },
  // Diariamente às 07:00: a Câmara regera o arquivo anual da cota durante a madrugada
  { id: 'camara-despesas', pattern: '0 0 7 * * *', job: JOBS.DESPESAS },
] as const;

@Injectable()
export class SyncScheduler implements OnApplicationBootstrap {
  private readonly logger = new Logger(SyncScheduler.name);

  constructor(
    @InjectQueue(QUEUES.SYNC) private readonly queue: Queue,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (!this.config.SYNC_CRON_ENABLED) {
      for (const { id } of AGENDAMENTOS) await this.queue.removeJobScheduler(id);
      this.logger.warn('Agendamentos desabilitados (SYNC_CRON_ENABLED=false)');
      return;
    }
    for (const { id, pattern, job } of AGENDAMENTOS) {
      await this.queue.upsertJobScheduler(id, { pattern, tz: TZ }, { name: job, data: {} });
      this.logger.log(`Agendado ${job}: "${pattern}" (${TZ})`);
    }
  }
}
