import type { Queue } from 'bullmq';
import type { AppConfig } from '../config/config.module';
import { parseEnv } from '../config/env';
import type { PrismaService } from '../prisma/prisma.service';
import type { EmendasSyncService } from '../sync/emendas-sync.service';
import { JOBS } from '../sync/sync.jobs';
import { AGENDAMENTOS, SyncScheduler } from './sync.scheduler';

function criar({
  sincronizacoes = 0,
  emendasHabilitadas = true,
  env = {},
}: { sincronizacoes?: number; emendasHabilitadas?: boolean; env?: Record<string, string> } = {}) {
  const queue = {
    upsertJobScheduler: vi.fn(() => Promise.resolve()),
    removeJobScheduler: vi.fn(() => Promise.resolve()),
    addBulk: vi.fn(() => Promise.resolve([])),
  };
  const config: AppConfig = parseEnv({
    DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
    REDIS_URL: 'redis://localhost:6379',
    SYNC_INITIAL_YEARS: '2025,2026',
    ...env,
  });
  const prisma = { syncRun: { count: vi.fn(() => Promise.resolve(sincronizacoes)) } };
  const scheduler = new SyncScheduler(
    queue as unknown as Queue,
    config,
    { habilitado: emendasHabilitadas } as EmendasSyncService,
    prisma as unknown as PrismaService,
  );
  return { scheduler, queue };
}

describe('SyncScheduler', () => {
  it('registra todos os agendamentos', async () => {
    const { scheduler, queue } = criar({ sincronizacoes: 1 });
    await scheduler.onApplicationBootstrap();
    expect(queue.upsertJobScheduler).toHaveBeenCalledTimes(AGENDAMENTOS.length);
    expect(queue.addBulk).not.toHaveBeenCalled();
  });

  it('enfileira a carga inicial, em ordem, quando o banco está vazio', async () => {
    const { scheduler, queue } = criar();
    await scheduler.onApplicationBootstrap();
    expect(queue.addBulk).toHaveBeenCalledWith([
      { name: JOBS.DEPUTADOS, data: {}, opts: { jobId: `carga-inicial:${JOBS.DEPUTADOS}` } },
      {
        name: JOBS.DESPESAS,
        data: { anos: [2025, 2026] },
        opts: { jobId: `carga-inicial:${JOBS.DESPESAS}` },
      },
      { name: JOBS.SENADORES, data: {}, opts: { jobId: `carga-inicial:${JOBS.SENADORES}` } },
      {
        name: JOBS.SENADO_DESPESAS,
        data: { anos: [2025, 2026] },
        opts: { jobId: `carga-inicial:${JOBS.SENADO_DESPESAS}` },
      },
      {
        name: JOBS.EMENDAS,
        data: { anos: [2025, 2026] },
        opts: { jobId: `carga-inicial:${JOBS.EMENDAS}` },
      },
    ]);
  });

  it('não inclui emendas sem a chave do Portal da Transparência', async () => {
    const { scheduler, queue } = criar({ emendasHabilitadas: false });
    await scheduler.onApplicationBootstrap();
    const [[jobs]] = queue.addBulk.mock.calls as unknown as [[{ name: string }[]]];
    expect(jobs.map((j) => j.name)).not.toContain(JOBS.EMENDAS);
    expect(queue.removeJobScheduler).toHaveBeenCalledWith('transparencia-emendas');
  });

  it('respeita SYNC_INITIAL_ON_EMPTY_DB=false e SYNC_CRON_ENABLED=false', async () => {
    const { scheduler, queue } = criar({
      env: { SYNC_INITIAL_ON_EMPTY_DB: 'false', SYNC_CRON_ENABLED: 'false' },
    });
    await scheduler.onApplicationBootstrap();
    expect(queue.addBulk).not.toHaveBeenCalled();
    expect(queue.upsertJobScheduler).not.toHaveBeenCalled();
    expect(queue.removeJobScheduler).toHaveBeenCalledTimes(AGENDAMENTOS.length);
  });
});
