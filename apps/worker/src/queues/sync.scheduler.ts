import { InjectQueue } from '@nestjs/bullmq';
import { Inject, Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { Queue } from 'bullmq';
import { APP_CONFIG, type AppConfig } from '../config/config.module';
import { EmendasSyncService } from '../sync/emendas-sync.service';
import { JOBS } from '../sync/sync.jobs';
import { QUEUES } from './queues.module';

const TZ = 'America/Sao_Paulo';

/** Agendamentos (cron) registrados no Redis. `upsertJobScheduler` é idempotente. */
export const AGENDAMENTOS = [
  // Segunda-feira às 04:00: lista de deputados muda pouco (posses, licenças, trocas de partido)
  { id: 'camara-deputados', pattern: '0 0 4 * * 1', job: JOBS.DEPUTADOS },
  // Diariamente às 07:00: a Câmara regera o arquivo anual da cota durante a madrugada
  { id: 'camara-despesas', pattern: '0 0 7 * * *', job: JOBS.DESPESAS },
  // Segunda-feira às 04:30: senadores (posses de suplentes, trocas de partido)
  { id: 'senado-senadores', pattern: '0 30 4 * * 1', job: JOBS.SENADORES },
  // Diariamente às 07:30: o Senado atualiza o CSV da CEAPS de madrugada (~02:00)
  { id: 'senado-despesas', pattern: '0 30 7 * * *', job: JOBS.SENADO_DESPESAS },
  // Domingo às 02:00: emendas mudam devagar e o Portal permite mais requisições à noite
  { id: 'transparencia-emendas', pattern: '0 0 2 * * 0', job: JOBS.EMENDAS },
] as const;

@Injectable()
export class SyncScheduler implements OnApplicationBootstrap {
  private readonly logger = new Logger(SyncScheduler.name);

  constructor(
    @InjectQueue(QUEUES.SYNC) private readonly queue: Queue,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly emendas: EmendasSyncService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (!this.config.SYNC_CRON_ENABLED) {
      for (const { id } of AGENDAMENTOS) await this.queue.removeJobScheduler(id);
      this.logger.warn('Agendamentos desabilitados (SYNC_CRON_ENABLED=false)');
      return;
    }
    for (const { id, pattern, job } of AGENDAMENTOS) {
      if (job === JOBS.EMENDAS && !this.emendas.habilitado) {
        await this.queue.removeJobScheduler(id);
        this.logger.warn('Emendas não agendadas: TRANSPARENCIA_API_KEY não configurada');
        continue;
      }
      await this.queue.upsertJobScheduler(id, { pattern, tz: TZ }, { name: job, data: {} });
      this.logger.log(`Agendado ${job}: "${pattern}" (${TZ})`);
    }
  }
}
