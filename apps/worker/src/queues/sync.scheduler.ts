import { InjectQueue } from '@nestjs/bullmq';
import { Inject, Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { Queue } from 'bullmq';
import { APP_CONFIG, type AppConfig } from '../config/config.module';
import { PrismaService } from '../prisma/prisma.service';
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
    private readonly prisma: PrismaService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.agendar();
    await this.cargaInicialSeVazio();
  }

  /**
   * Num banco recém-criado (deploy novo), enfileira a carga inicial dos anos em
   * SYNC_INITIAL_YEARS, para não depender de acesso a um shell no servidor. Os ids fixos
   * evitam enfileirar de novo se o worker reiniciar no meio da carga.
   */
  private async cargaInicialSeVazio(): Promise<void> {
    if (!this.config.SYNC_INITIAL_ON_EMPTY_DB) return;
    const sincronizacoes = await this.prisma.syncRun.count({ where: { status: 'SUCCESS' } });
    if (sincronizacoes > 0) return;

    const anos = this.config.SYNC_INITIAL_YEARS;
    const jobs: { name: string; data: { anos?: number[] } }[] = [
      { name: JOBS.DEPUTADOS, data: {} },
      { name: JOBS.DESPESAS, data: { anos } },
      { name: JOBS.SENADORES, data: {} },
      { name: JOBS.SENADO_DESPESAS, data: { anos } },
      ...(this.emendas.habilitado ? [{ name: JOBS.EMENDAS, data: { anos } }] : []),
    ];
    // Concorrência 1 e ordem de chegada: deputados e senadores antes das despesas.
    await this.queue.addBulk(
      jobs.map((job) => ({ ...job, opts: { jobId: `carga-inicial:${job.name}` } })),
    );
    this.logger.log(`Banco vazio: carga inicial de ${anos.join(', ')} enfileirada`);
  }

  private async agendar(): Promise<void> {
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
