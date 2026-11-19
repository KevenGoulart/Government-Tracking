import type { Job } from 'bullmq';
import type { DeputadosSyncService } from '../sync/deputados-sync.service';
import type { DespesasSyncService } from '../sync/despesas-sync.service';
import type { EmendasSyncService } from '../sync/emendas-sync.service';
import type { SenadoDespesasSyncService } from '../sync/senado-despesas-sync.service';
import type { SenadoresSyncService } from '../sync/senadores-sync.service';
import { anosRecentes, JOBS } from '../sync/sync.jobs';
import { SyncProcessor } from './sync.processor';

function criar() {
  const umaVez = () => ({ sincronizar: vi.fn(() => Promise.resolve({ processados: 1 })) });
  const porAno = () => ({
    sincronizarAno: vi.fn((ano: number) => Promise.resolve({ processados: ano })),
  });
  const deputados = umaVez();
  const despesas = porAno();
  const senadores = umaVez();
  const senadoDespesas = porAno();
  const emendas = porAno();
  const processor = new SyncProcessor(
    deputados as unknown as DeputadosSyncService,
    despesas as unknown as DespesasSyncService,
    senadores as unknown as SenadoresSyncService,
    senadoDespesas as unknown as SenadoDespesasSyncService,
    emendas as unknown as EmendasSyncService,
  );
  return { processor, deputados, despesas, senadores, senadoDespesas, emendas };
}

const job = (name: string, data: unknown = {}) => ({ name, data }) as Job;

describe('SyncProcessor', () => {
  it('despacha os jobs de cadastro (deputados e senadores)', async () => {
    const { processor, deputados, senadores } = criar();
    await processor.process(job(JOBS.DEPUTADOS));
    await processor.process(job(JOBS.SENADORES));
    expect(deputados.sincronizar).toHaveBeenCalledOnce();
    expect(senadores.sincronizar).toHaveBeenCalledOnce();
  });

  it.each([
    [JOBS.DESPESAS, 'despesas'],
    [JOBS.SENADO_DESPESAS, 'senadoDespesas'],
    [JOBS.EMENDAS, 'emendas'],
  ] as const)('%s sincroniza os anos informados em ordem', async (nome, servico) => {
    const servicos = criar();
    await servicos.processor.process(job(nome, { anos: [2024, 2025] }));
    expect(servicos[servico].sincronizarAno.mock.calls).toEqual([[2024], [2025]]);
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
    expect(anosRecentes(new Date('2026-06-10T12:00:00Z'))).toEqual([2025, 2026]);
  });
});
