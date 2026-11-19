import { truncateAll } from '@raio-x/db/testing';
import { inject } from 'vitest';
import { LINHAS_EXEMPLO, linha, montarCsv, montarZip } from '../src/camara/__fixtures__/cota';
import type {
  CamaraApiClient,
  DeputadoDetalhe,
  DeputadoLista,
} from '../src/camara/camara-api.client';
import type { HttpClient } from '../src/comum/http-client';
import { parseEnv } from '../src/config/env';
import { PrismaService } from '../src/prisma/prisma.service';
import { DeputadosSyncService } from '../src/sync/deputados-sync.service';
import { DespesasSyncService } from '../src/sync/despesas-sync.service';
import { DespesasRepository } from '../src/sync/despesas.repository';
import { SyncRunService } from '../src/sync/sync-run.service';

const config = parseEnv({
  DATABASE_URL: inject('databaseUrl'),
  REDIS_URL: 'redis://localhost:6379',
  CAMARA_COTAS_BASE_URL: 'https://cotas.test',
});
const prisma = new PrismaService(config);
const syncRun = new SyncRunService(prisma);

/** HttpClient falso que devolve o zip montado no teste. */
function httpComZip(obterCsv: () => string) {
  const getBytes = vi.fn((_url: string) => Promise.resolve(montarZip(obterCsv())));
  return { http: { getBytes } as unknown as HttpClient, getBytes };
}

beforeEach(async () => {
  await truncateAll(prisma);
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('DespesasSyncService (integração)', () => {
  let linhas: string[];
  const { http, getBytes } = httpComZip(() => montarCsv(linhas));
  const service = new DespesasSyncService(http, new DespesasRepository(prisma), syncRun, config);

  beforeEach(() => {
    linhas = [
      LINHAS_EXEMPLO.combustivel,
      LINHAS_EXEMPLO.ramalTelefonico,
      LINHAS_EXEMPLO.passagemEmitida,
      LINHAS_EXEMPLO.passagemCancelada,
      LINHAS_EXEMPLO.trechoComQuebraDeLinha,
      LINHAS_EXEMPLO.lideranca,
    ];
  });

  it('importa despesas, fornecedores, categorias e deputados ausentes', async () => {
    const resultado = await service.sincronizarAno(2025);

    expect(getBytes).toHaveBeenCalledWith('https://cotas.test/Ano-2025.csv.zip');
    expect(resultado).toEqual({
      processados: 5,
      detalhes: { inseridas: 5, removidas: 0, ignoradas: 1, deputados: 2 },
    });
    expect(await prisma.despesa.count()).toBe(5);
    expect(await prisma.categoria.count()).toBe(3);
    // posto, ramal (sem documento), TAM e AZUL
    expect(await prisma.fornecedor.count()).toBe(4);
    expect(
      await prisma.parlamentar.findMany({ select: { idExterno: true, emExercicio: true } }),
    ).toEqual(
      expect.arrayContaining([
        { idExterno: '136811', emExercicio: false },
        { idExterno: '74400', emExercicio: false },
      ]),
    );

    const ramal = await prisma.fornecedor.findUnique({ where: { chave: 'nome:RAMAL' } });
    expect(ramal?.documento).toBeNull();

    const total = await prisma.despesa.aggregate({ _sum: { valorLiquido: true } });
    // o estorno da passagem anula a emissão
    expect(total._sum.valorLiquido?.toString()).toBe('2675.96');
  });

  it('é idempotente: reprocessar o mesmo arquivo não altera nada', async () => {
    await service.sincronizarAno(2025);
    const antes = await prisma.despesa.findMany({ orderBy: { idExterno: 'asc' } });

    const resultado = await service.sincronizarAno(2025);

    expect(resultado.detalhes).toMatchObject({ inseridas: 0, removidas: 0 });
    expect(await prisma.despesa.findMany({ orderBy: { idExterno: 'asc' } })).toEqual(antes);
  });

  it('espelha a fonte: insere linhas novas e remove as que sumiram', async () => {
    await service.sincronizarAno(2025);

    linhas = linhas.filter((l) => l !== LINHAS_EXEMPLO.ramalTelefonico);
    linhas.push(
      linha({ txtNumero: '999', vlrDocumento: '50', vlrLiquido: '50', ideDocumento: '1' }),
    );
    const resultado = await service.sincronizarAno(2025);

    expect(resultado.detalhes).toMatchObject({ inseridas: 1, removidas: 1 });
    expect(await prisma.despesa.count()).toBe(5);
  });

  it('remove as despesas de um deputado que saiu do arquivo', async () => {
    await service.sincronizarAno(2025);
    linhas = linhas.filter((l) => l !== LINHAS_EXEMPLO.trechoComQuebraDeLinha);

    const resultado = await service.sincronizarAno(2025);

    expect(resultado.detalhes).toMatchObject({ removidas: 1, deputados: 1 });
  });

  it('não apaga dados quando o arquivo vem sem despesas e registra a falha', async () => {
    await service.sincronizarAno(2025);
    linhas = [LINHAS_EXEMPLO.lideranca];

    await expect(service.sincronizarAno(2025)).rejects.toThrow(/não contém despesas/);

    expect(await prisma.despesa.count()).toBe(5);
    const ultima = await prisma.syncRun.findFirst({ orderBy: { inicio: 'desc' } });
    expect(ultima).toMatchObject({ status: 'FAILED', fonte: 'camara:despesas' });
    expect(ultima?.erro).toMatch(/não contém despesas/);
  });

  it('registra a execução bem-sucedida em SyncRun', async () => {
    await service.sincronizarAno(2025);
    const run = await prisma.syncRun.findFirstOrThrow();
    expect(run).toMatchObject({ status: 'SUCCESS', processados: 5, escopo: { ano: 2025 } });
    expect(run.fim).not.toBeNull();
  });
});

describe('DeputadosSyncService (integração)', () => {
  const lista = (id: number, nome: string): DeputadoLista => ({
    id,
    nome,
    siglaPartido: 'PT',
    siglaUf: 'SP',
    urlFoto: null,
    email: null,
    idLegislatura: 57,
  });
  const detalhe = (id: number, nome: string): DeputadoDetalhe => ({
    id,
    nomeCivil: `${nome.toUpperCase()} DA SILVA`,
    ultimoStatus: {
      nome,
      siglaPartido: 'PSB',
      siglaUf: 'RJ',
      urlFoto: `https://www.camara.leg.br/internet/deputado/bandep/${id}.jpg`,
      email: null,
      situacao: 'Exercício',
    },
  });

  function criarApi(legislatura: DeputadoLista[], emExercicio: DeputadoLista[]) {
    const obterDeputado = vi.fn((id: number) =>
      Promise.resolve(detalhe(id, legislatura.find((d) => d.id === id)?.nome ?? '?')),
    );
    const listarDeputados = vi.fn((filtro: { idLegislatura?: number } = {}) =>
      Promise.resolve(filtro.idLegislatura ? legislatura : emExercicio),
    );
    return { api: { listarDeputados, obterDeputado } as unknown as CamaraApiClient, obterDeputado };
  }

  it('cria deputados com dados do detalhe e marca quem está em exercício', async () => {
    const ana = lista(1, 'Ana Lúcia');
    const bruno = lista(2, 'Bruno');
    const { api } = criarApi([ana, bruno, ana], [ana]);
    const service = new DeputadosSyncService(prisma, api, syncRun, config);

    const resultado = await service.sincronizar();

    expect(resultado.processados).toBe(2);
    const salvos = await prisma.parlamentar.findMany({ orderBy: { idExterno: 'asc' } });
    expect(salvos).toMatchObject([
      {
        idExterno: '1',
        nome: 'Ana Lúcia',
        nomeBusca: 'ana lucia',
        nomeCivil: 'ANA LÚCIA DA SILVA',
        partido: 'PSB',
        uf: 'RJ',
        emExercicio: true,
      },
      { idExterno: '2', emExercicio: false },
    ]);
  });

  it('só busca o detalhe de quem ainda não tem nome civil', async () => {
    const { api, obterDeputado } = criarApi([lista(1, 'Ana')], [lista(1, 'Ana')]);
    const service = new DeputadosSyncService(prisma, api, syncRun, config);

    await service.sincronizar();
    await service.sincronizar();

    expect(obterDeputado).toHaveBeenCalledTimes(1);
    expect(await prisma.parlamentar.count()).toBe(1);
  });

  it('marca como fora de exercício quem deixou a lista de ativos', async () => {
    const ana = lista(1, 'Ana');
    const bruno = lista(2, 'Bruno');
    const primeira = criarApi([ana, bruno], [ana, bruno]);
    await new DeputadosSyncService(prisma, primeira.api, syncRun, config).sincronizar();

    // Ana segue na legislatura mas saiu de exercício; Bruno sumiu da lista por completo
    const segunda = criarApi([ana], []);
    const resultado = await new DeputadosSyncService(
      prisma,
      segunda.api,
      syncRun,
      config,
    ).sincronizar();

    expect(resultado.detalhes).toMatchObject({ inativados: 1 });
    expect(
      await prisma.parlamentar.findMany({
        select: { idExterno: true, emExercicio: true },
        orderBy: { idExterno: 'asc' },
      }),
    ).toEqual([
      { idExterno: '1', emExercicio: false },
      { idExterno: '2', emExercicio: false },
    ]);
  });
});
