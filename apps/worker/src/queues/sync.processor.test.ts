import type { Job } from 'bullmq';
import type { DeputadosSyncService } from '../sync/deputados-sync.service';
import type { DespesasSyncService } from '../sync/despesas-sync.service';
import { anosRecentes, JOBS } from '../sync/sync.jobs';
import { SyncProcessor } from './sync.processor';

function criar() {
  const deputados = { sincronizar: vi.fn(() => Promise.resolve({ processados: 1 })) };
  const despesas = {
    sincronizarAno: vi.fn((ano: number) => Promise.resolve({ processados: ano })),
  };
  const processor = new SyncProcessor(
    deputados as unknown as DeputadosSyncService,
    despesas as unknown as DespesasSyncService,
  );
  return { processor, deputados, despesas };
}

const job = (name: string, data: unknown = {}) => ({ name, data }) as Job;

describe('SyncProcessor', () => {
  it('despacha o job de deputados', async () => {
    const { processor, deputados } = criar();
    await processor.process(job(JOBS.DEPUTADOS));
    expect(deputados.sincronizar).toHaveBeenCalledOnce();
  });

  it('sincroniza os anos informados em ordem', async () => {
    const { processor, despesas } = criar();
    await processor.process(job(JOBS.DESPESAS, { anos: [2024, 2025] }));
    expect(despesas.sincronizarAno.mock.calls).toEqual([[2024], [2025]]);
  });

  it('usa os anos recentes quando o job não informa anos', async () => {
    const { processor, despesas } = criar();
    await processor.process(job(JOBS.DESPESAS));
    expect(despesas.sincronizarAno.mock.calls.map(([ano]) => ano)).toEqual(anosRecentes());
  });

  it('rejeita dados inválidos e jobs desconhecidos', async () => {
    const { processor } = criar();
    await expect(processor.process(job(JOBS.DESPESAS, { anos: ['2025'] }))).rejects.toThrow();
    await expect(processor.process(job('outro'))).rejects.toThrow(/Job desconhecido/);
  });
});

describe('anosRecentes', () => {
  it('retorna o ano anterior e o atual', () => {
    expect(anosRecentes(new Date('2026-01-10T12:00:00Z'))).toEqual([2025, 2026]);
  });
});
