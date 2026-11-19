import { truncateAll } from '@raio-x/db/testing';
import { inject } from 'vitest';
import { LINHAS_EXEMPLO, montarCsv, montarZip } from '../src/camara/__fixtures__/cota';
import type { HttpClient } from '../src/comum/http-client';
import { parseEnv } from '../src/config/env';
import { PrismaService } from '../src/prisma/prisma.service';
import { linhaCeaps, montarCeaps } from '../src/senado/__fixtures__/ceaps';
import type { SenadoApiClient, Senador } from '../src/senado/senado-api.client';
import { DespesasSyncService } from '../src/sync/despesas-sync.service';
import { DespesasRepository } from '../src/sync/despesas.repository';
import { EmendasSyncService } from '../src/sync/emendas-sync.service';
import { SenadoDespesasSyncService } from '../src/sync/senado-despesas-sync.service';
import { SenadoresSyncService } from '../src/sync/senadores-sync.service';
import { SyncRunService } from '../src/sync/sync-run.service';
import type {
  EmendaPortal,
  PortalTransparenciaClient,
} from '../src/transparencia/portal-transparencia.client';

const config = parseEnv({
  DATABASE_URL: inject('databaseUrl'),
  REDIS_URL: 'redis://localhost:6379',
  CAMARA_COTAS_BASE_URL: 'https://cotas.test',
  SENADO_CEAPS_BASE_URL: 'https://ceaps.test',
});
const prisma = new PrismaService(config);
const syncRun = new SyncRunService(prisma);
const repository = new DespesasRepository(prisma);

const senador = (codigo: string, nome: string, nomeCompleto: string): Senador => ({
  codigo,
  nome,
  nomeCompleto,
  partido: null,
  uf: 'AC',
  fotoUrl: null,
  email: null,
});

const ALAN = senador('5672', 'Alan Rick', 'Alan Rick Miranda');
const WEVERTON = senador('5411', 'Weverton', 'Weverton Rocha Marques de Sousa');
const FC1 = senador('5980', 'Fernando Carvalho', 'Fernando Luiz Prado Carvalho Junior');
const FC2 = senador('6384', 'Fernando Carvalho', 'Antonio Fernando Pereira de Carvalho');

function apiSenado(legislatura: Senador[], emExercicio: Senador[]) {
  const obterSenador = vi.fn((codigo: string) =>
    Promise.resolve({ ...legislatura.find((s) => s.codigo === codigo)!, partido: 'PSD' }),
  );
  const api = {
    listarDaLegislatura: () => Promise.resolve(legislatura),
    listarEmExercicio: () =>
      Promise.resolve(emExercicio.map((s) => ({ ...s, partido: 'REPUBLICANOS' }))),
    obterSenador,
  } as unknown as SenadoApiClient;
  return { api, obterSenador };
}

const sincronizarSenadores = (legislatura: Senador[], emExercicio: Senador[] = legislatura) =>
  new SenadoresSyncService(
    prisma,
    apiSenado(legislatura, emExercicio).api,
    syncRun,
    config,
  ).sincronizar();

beforeEach(async () => {
  await truncateAll(prisma);
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('SenadoresSyncService (integração)', () => {
  it('cria senadores e busca o detalhe só de quem não está em exercício, uma vez', async () => {
    const { api, obterSenador } = apiSenado([ALAN, WEVERTON], [ALAN]);
    const service = new SenadoresSyncService(prisma, api, syncRun, config);

    await service.sincronizar();
    await service.sincronizar();

    expect(obterSenador).toHaveBeenCalledTimes(1);
    expect(obterSenador).toHaveBeenCalledWith('5411');
    const salvos = await prisma.parlamentar.findMany({
      where: { casa: 'SENADO' },
      orderBy: { idExterno: 'asc' },
      select: { idExterno: true, nome: true, nomeCivil: true, partido: true, emExercicio: true },
    });
    expect(salvos).toEqual([
      {
        idExterno: '5411',
        nome: 'Weverton',
        nomeCivil: 'Weverton Rocha Marques de Sousa',
        partido: 'PSD',
        emExercicio: false,
      },
      {
        idExterno: '5672',
        nome: 'Alan Rick',
        nomeCivil: 'Alan Rick Miranda',
        partido: 'REPUBLICANOS',
        emExercicio: true,
      },
    ]);
  });
});

describe('SenadoresSyncService (limpeza)', () => {
  it('remove quem deixou de constar como senador, exceto se tiver despesas', async () => {
    await sincronizarSenadores([ALAN, WEVERTON, FC1]);
    const fc1 = await prisma.parlamentar.findFirstOrThrow({ where: { idExterno: '5980' } });
    const categoria = await prisma.categoria.create({
      data: { slug: 'x', nome: 'X', casa: 'SENADO' },
    });
    await prisma.despesa.create({
      data: {
        idExterno: 'senado:2025:1',
        parlamentarId: fc1.id,
        categoriaId: categoria.id,
        ano: 2025,
        mes: 1,
        valorDocumento: '1',
        valorLiquido: '1',
      },
    });

    // Weverton e FC1 não aparecem mais (ex.: suplentes que nunca exerceram)
    const resultado = await sincronizarSenadores([ALAN], [ALAN]);

    expect(resultado.detalhes).toMatchObject({ removidos: 1 });
    const restantes = await prisma.parlamentar.findMany({
      where: { casa: 'SENADO' },
      select: { idExterno: true },
      orderBy: { idExterno: 'asc' },
    });
    expect(restantes.map((p) => p.idExterno)).toEqual(['5672', '5980']);
  });
});

describe('SenadoDespesasSyncService (integração)', () => {
  let linhas: string[];
  const http = {
    getBytes: vi.fn(() => Promise.resolve(montarCeaps(linhas))),
  } as unknown as HttpClient;
  const service = new SenadoDespesasSyncService(http, prisma, repository, syncRun, config);

  beforeEach(() => {
    linhas = [
      linhaCeaps(),
      linhaCeaps({ COD_DOCUMENTO: '2', VALOR_REEMBOLSADO: '-100,00' }),
      linhaCeaps({ SENADOR: 'WEVERTON ROCHA', COD_DOCUMENTO: '3', TIPO_DESPESA: '' }),
      linhaCeaps({ SENADOR: 'FERNANDO CARVALHO', COD_DOCUMENTO: '4' }),
      linhaCeaps({ SENADOR: 'FULANO DESCONHECIDO', COD_DOCUMENTO: '5' }),
    ];
  });

  it('exige que os senadores tenham sido sincronizados antes', async () => {
    await expect(service.sincronizarAno(2025)).rejects.toThrow(/sincronize os senadores/);
  });

  it('vincula pelo nome, separa categorias do Senado e registra os nomes sem vínculo', async () => {
    await sincronizarSenadores([ALAN, WEVERTON, FC1, FC2]);

    const resultado = await service.sincronizarAno(2025);

    expect(resultado).toMatchObject({
      processados: 3,
      detalhes: {
        inseridas: 3,
        senadores: 2,
        linhasSemVinculo: 2,
        semVinculo: [
          { nome: 'FERNANDO CARVALHO', motivo: 'ambiguo', linhas: 1 },
          { nome: 'FULANO DESCONHECIDO', motivo: 'nao-encontrado', linhas: 1 },
        ],
      },
    });
    const categorias = await prisma.categoria.findMany({ select: { slug: true, casa: true } });
    expect(categorias.every((c) => c.casa === 'SENADO' && c.slug.startsWith('senado-'))).toBe(true);
    const weverton = await prisma.parlamentar.findFirstOrThrow({ where: { idExterno: '5411' } });
    expect(await prisma.despesa.count({ where: { parlamentarId: weverton.id } })).toBe(1);
  });

  it('é idempotente e espelha a fonte', async () => {
    await sincronizarSenadores([ALAN, WEVERTON]);
    await service.sincronizarAno(2025);

    expect((await service.sincronizarAno(2025)).detalhes).toMatchObject({
      inseridas: 0,
      removidas: 0,
    });

    linhas = linhas.filter((l) => !l.endsWith('"2"'));
    expect((await service.sincronizarAno(2025)).detalhes).toMatchObject({
      inseridas: 0,
      removidas: 1,
    });
  });

  it('não apaga despesas da Câmara do mesmo ano', async () => {
    const camara = new DespesasSyncService(
      {
        getBytes: () => Promise.resolve(montarZip(montarCsv([LINHAS_EXEMPLO.combustivel]))),
      } as unknown as HttpClient,
      repository,
      syncRun,
      config,
    );
    await camara.sincronizarAno(2025);
    await sincronizarSenadores([ALAN]);

    await service.sincronizarAno(2025);

    expect(await prisma.despesa.count({ where: { parlamentar: { casa: 'CAMARA' } } })).toBe(1);
  });
});

describe('EmendasSyncService (integração)', () => {
  const emenda = (
    codigo: string,
    nomeAutor: string,
    extra: Partial<EmendaPortal> = {},
  ): EmendaPortal => ({
    codigoEmenda: codigo,
    ano: 2025,
    tipoEmenda: 'Emenda Individual - Transferências Especiais',
    nomeAutor,
    numeroEmenda: '0001',
    localidadeDoGasto: 'RIO BRANCO - AC',
    funcao: 'Saúde',
    subfuncao: 'Atenção básica',
    valorEmpenhado: '1.000,00',
    valorLiquidado: '500,00',
    valorPago: '400,00',
    valorRestoInscrito: '0,00',
    valorRestoCancelado: '0,00',
    valorRestoPago: '0,00',
    ...extra,
  });

  function portal(paginas: EmendaPortal[][]) {
    return {
      // eslint-disable-next-line @typescript-eslint/require-await
      async *listarEmendas() {
        for (const p of paginas) yield p;
      },
    } as unknown as PortalTransparenciaClient;
  }

  it('vincula autores, separa bancadas e conta nomes sem correspondência', async () => {
    await sincronizarSenadores([ALAN, FC1, FC2]);
    const service = new EmendasSyncService(
      prisma,
      syncRun,
      portal([
        [emenda('1', 'ALAN RICK'), emenda('2', 'ALAN RICK (EX-PARLAMENTAR X, NOS TERMOS ART. 78)')],
        [
          emenda('3', 'BANCADA DO ACRE', { tipoEmenda: 'Emenda de Bancada' }),
          emenda('4', 'FERNANDO CARVALHO'),
          emenda('5', 'NINGUEM CONHECIDO'),
        ],
      ]),
    );

    const resultado = await service.sincronizarAno(2025);

    expect(resultado).toMatchObject({
      processados: 5,
      detalhes: { vinculadas: 2, coletivas: 1, semVinculo: 2 },
    });
    const alan = await prisma.parlamentar.findFirstOrThrow({ where: { idExterno: '5672' } });
    const doAlan = await prisma.emenda.findMany({
      where: { parlamentarId: alan.id },
      orderBy: { codigo: 'asc' },
    });
    expect(doAlan.map((e) => [e.codigo, e.valorEmpenhado.toString(), e.observacaoAutor])).toEqual([
      ['1', '1000', null],
      ['2', '1000', 'EX-PARLAMENTAR X, NOS TERMOS ART. 78'],
    ]);
  });

  it('substitui o ano inteiro: valores atualizados e emendas removidas da fonte', async () => {
    await sincronizarSenadores([ALAN]);
    const primeira = new EmendasSyncService(
      prisma,
      syncRun,
      portal([[emenda('1', 'ALAN RICK'), emenda('2', 'ALAN RICK')]]),
    );
    await primeira.sincronizarAno(2025);

    const segunda = new EmendasSyncService(
      prisma,
      syncRun,
      portal([[emenda('1', 'ALAN RICK', { valorPago: '1.000,00' })]]),
    );
    await segunda.sincronizarAno(2025);

    const emendas = await prisma.emenda.findMany();
    expect(emendas.map((e) => [e.codigo, e.valorPago.toString()])).toEqual([['1', '1000']]);
  });

  it('não apaga o ano quando a fonte não retorna nada', async () => {
    await sincronizarSenadores([ALAN]);
    await new EmendasSyncService(
      prisma,
      syncRun,
      portal([[emenda('1', 'ALAN RICK')]]),
    ).sincronizarAno(2025);

    await expect(
      new EmendasSyncService(prisma, syncRun, portal([])).sincronizarAno(2025),
    ).rejects.toThrow(/não retornou emendas/);
    expect(await prisma.emenda.count()).toBe(1);
  });

  it('avisa claramente quando a chave da API não está configurada', async () => {
    const service = new EmendasSyncService(prisma, syncRun, null);
    expect(service.habilitado).toBe(false);
    await expect(service.sincronizarAno(2025)).rejects.toThrow(/TRANSPARENCIA_API_KEY/);
  });
});
