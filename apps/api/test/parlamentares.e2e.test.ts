import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  despesaSchema,
  emendasParlamentarSchema,
  filtrosParlamentaresSchema,
  gastoMensalSchema,
  paginatedSchema,
  parlamentarDetalheSchema,
  parlamentarResumoSchema,
  syncStatusSchema,
} from '@raio-x/shared';
import request from 'supertest';
import type { App } from 'supertest/types';
import { z } from 'zod';
import { AppModule } from '../src/app.module';
import { setupApp } from '../src/app.setup';
import { PrismaService } from '../src/prisma/prisma.service';
import { seed } from './seed';

describe('Parlamentares (e2e)', () => {
  let app: INestApplication<App>;
  let ids: Awaited<ReturnType<typeof seed>>;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    setupApp(app);
    await app.init();
    ids = await seed(app.get(PrismaService));
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /parlamentares', () => {
    const lista = paginatedSchema(parlamentarResumoSchema);

    it('lista com paginação, em exercício primeiro e por nome', async () => {
      const res = await http().get('/parlamentares?pageSize=2').expect(200);
      const body = lista.parse(res.body);
      expect(body.data.map((p) => p.nome)).toEqual(['Ana Lúcia Souza', 'Bruno Carvalho']);
      expect(body.meta).toEqual({ page: 1, pageSize: 2, total: 4, totalPages: 2 });
    });

    it.each([
      ['acento e caixa', 'ANA LUCIA', 'Ana Lúcia Souza'],
      ['erro de digitação', 'carvaho', 'Bruno Carvalho'],
      ['trecho do nome', 'antun', 'Carla Antunes'],
    ])('busca por nome tolerando %s', async (_caso, nome, esperado) => {
      const res = await http().get('/parlamentares').query({ nome }).expect(200);
      expect(lista.parse(res.body).data[0]?.nome).toBe(esperado);
    });

    it('filtra por partido e UF (sem diferenciar maiúsculas)', async () => {
      const res = await http().get('/parlamentares?partido=pt&uf=mg').expect(200);
      expect(lista.parse(res.body).data.map((p) => p.nome)).toEqual(['Carla Antunes']);
    });

    it('ignora filtros vazios enviados por formulários', async () => {
      const res = await http().get('/parlamentares?nome=&partido=&uf=').expect(200);
      expect(lista.parse(res.body).meta.total).toBe(4);
    });

    it('trata caracteres curinga do LIKE como texto', async () => {
      const res = await http().get('/parlamentares').query({ nome: '%%' }).expect(200);
      expect(lista.parse(res.body).meta.total).toBe(0);
    });

    it('responde 400 com os campos inválidos', async () => {
      const res = await http().get('/parlamentares?uf=XX&page=0').expect(400);
      const body = res.body as { errors: { path: string }[] };
      expect(body.errors.map((e) => e.path).sort()).toEqual(['page', 'uf']);
    });
  });

  it('GET /parlamentares/filtros retorna partidos e UFs distintos', async () => {
    const res = await http().get('/parlamentares/filtros').expect(200);
    expect(filtrosParlamentaresSchema.parse(res.body)).toEqual({
      partidos: ['PL', 'PT'],
      ufs: ['AP', 'MG', 'RJ', 'SP'],
    });
  });

  it('GET /categorias lista as categorias, com filtro por casa', async () => {
    expect((await http().get('/categorias').expect(200)).body).toHaveLength(3);
    expect((await http().get('/categorias?casa=CAMARA').expect(200)).body).toHaveLength(2);
    const senado = await http().get('/categorias?casa=SENADO').expect(200);
    expect(senado.body).toEqual([
      { slug: 'senado-aluguel-de-imoveis', nome: 'Aluguel de imóveis' },
    ]);
  });

  it('filtra a listagem por casa', async () => {
    const res = await http().get('/parlamentares?casa=SENADO').expect(200);
    expect(
      paginatedSchema(parlamentarResumoSchema)
        .parse(res.body)
        .data.map((p) => p.nome),
    ).toEqual(['Davi Senador']);
  });

  describe('GET /parlamentares/:id/emendas', () => {
    it('retorna totais do ano mais recente, por área e localidade, sem emendas de bancada', async () => {
      const res = await http().get(`/parlamentares/${ids.ana.id}/emendas`).expect(200);
      const body = emendasParlamentarSchema.parse(res.body);
      expect(body).toMatchObject({
        ano: 2025,
        anosDisponiveis: [
          { ano: 2025, empenhado: '4000.00', pago: '3400.00', quantidade: 2 },
          { ano: 2024, empenhado: '500.00', pago: '0.00', quantidade: 1 },
        ],
        totais: { empenhado: '4000.00', pago: '3400.00', quantidade: 2 },
        porFuncao: [
          { funcao: 'Educação', empenhado: '3000.00', pago: '3000.00', quantidade: 1 },
          { funcao: 'Saúde', empenhado: '1000.00', pago: '400.00', quantidade: 1 },
        ],
      });
      expect(body.data.map((e) => e.codigo)).toEqual(['E2', 'E1']);
      expect(body.porLocalidade[0]).toMatchObject({ localidade: 'CAMPINAS - SP' });
    });

    it('aceita o ano e responde vazio para quem não tem emendas', async () => {
      const ano2024 = await http().get(`/parlamentares/${ids.ana.id}/emendas?ano=2024`).expect(200);
      expect(emendasParlamentarSchema.parse(ano2024.body).totais.empenhado).toBe('500.00');
      const bruno = await http().get(`/parlamentares/${ids.bruno.id}/emendas`).expect(200);
      expect(emendasParlamentarSchema.parse(bruno.body)).toMatchObject({ ano: null, data: [] });
    });

    it('responde 404 para parlamentar inexistente', async () => {
      await http().get('/parlamentares/cl0000000000000000000000/emendas').expect(404);
    });
  });

  describe('GET /parlamentares/:id', () => {
    it('retorna dados e resumo do ano mais recente', async () => {
      const res = await http().get(`/parlamentares/${ids.ana.id}`).expect(200);
      const body = parlamentarDetalheSchema.parse(res.body);
      expect(body).toMatchObject({ nome: 'Ana Lúcia Souza', nomeCivil: 'ANA LÚCIA SOUZA' });
      expect(body.resumo).toEqual({
        anoReferencia: 2025,
        anosDisponiveis: [
          { ano: 2025, total: '1300.00', quantidade: 3 },
          { ano: 2024, total: '50.00', quantidade: 1 },
        ],
        totalAno: '1300.00',
        categorias: [
          {
            slug: 'divulgacao-da-atividade-parlamentar',
            nome: 'DIVULGAÇÃO DA ATIVIDADE PARLAMENTAR',
            total: '1000.00',
          },
          {
            slug: 'combustiveis-e-lubrificantes',
            nome: 'COMBUSTÍVEIS E LUBRIFICANTES',
            total: '300.00',
          },
        ],
        fornecedores: [
          expect.objectContaining({ nome: 'Gráfica X', documento: null, total: '1000.00' }),
          expect.objectContaining({
            nome: 'POSTO NATIVUS LTDA',
            documento: '04971874000147',
            total: '300.00',
          }),
        ],
      });
    });

    it('aceita um ano de referência', async () => {
      const res = await http().get(`/parlamentares/${ids.ana.id}?ano=2024`).expect(200);
      const { resumo } = parlamentarDetalheSchema.parse(res.body);
      expect(resumo).toMatchObject({ anoReferencia: 2024, totalAno: '50.00' });
    });

    it('soma estornos (valores negativos) no total', async () => {
      const res = await http().get(`/parlamentares/${ids.bruno.id}`).expect(200);
      expect(parlamentarDetalheSchema.parse(res.body).resumo.totalAno).toBe('250.00');
    });

    it('retorna resumo vazio para quem não tem despesas', async () => {
      const res = await http().get(`/parlamentares/${ids.carla.id}`).expect(200);
      expect(parlamentarDetalheSchema.parse(res.body).resumo).toEqual({
        anoReferencia: null,
        anosDisponiveis: [],
        totalAno: '0.00',
        categorias: [],
        fornecedores: [],
      });
    });

    it.each(['cl0000000000000000000000', 'nao-existe'])('responde 404 para id %s', async (id) => {
      await http().get(`/parlamentares/${id}`).expect(404);
    });
  });

  describe('GET /parlamentares/:id/despesas', () => {
    const lista = paginatedSchema(despesaSchema);

    it('lista por data decrescente com categoria e fornecedor', async () => {
      const res = await http().get(`/parlamentares/${ids.ana.id}/despesas`).expect(200);
      const body = lista.parse(res.body);
      expect(body.meta.total).toBe(4);
      expect(body.data.map((d) => d.dataDocumento)).toEqual([
        '2025-03-10',
        '2025-01-20',
        '2025-01-05',
        '2024-12-10',
      ]);
      expect(body.data[0]).toMatchObject({
        valorLiquido: '1000.00',
        categoria: { slug: 'divulgacao-da-atividade-parlamentar' },
        fornecedor: { nome: 'Gráfica X' },
      });
    });

    it('filtra por ano, mês e categoria', async () => {
      const res = await http()
        .get(`/parlamentares/${ids.ana.id}/despesas`)
        .query({ ano: 2025, mes: 1, categoria: 'combustiveis-e-lubrificantes' })
        .expect(200);
      expect(lista.parse(res.body).data.map((d) => d.valorLiquido)).toEqual(['200.00', '100.00']);
    });

    it('ordena por valor', async () => {
      const res = await http()
        .get(`/parlamentares/${ids.ana.id}/despesas?ordenarPor=valor&ordem=asc&ano=2025`)
        .expect(200);
      expect(lista.parse(res.body).data.map((d) => d.valorLiquido)).toEqual([
        '100.00',
        '200.00',
        '1000.00',
      ]);
    });

    it('responde 404 para parlamentar inexistente', async () => {
      await http().get('/parlamentares/cl0000000000000000000000/despesas').expect(404);
    });
  });

  it('GET /parlamentares/:id/gastos-mensais retorna a série ordenada', async () => {
    const res = await http().get(`/parlamentares/${ids.ana.id}/gastos-mensais`).expect(200);
    expect(z.array(gastoMensalSchema).parse(res.body)).toEqual([
      { ano: 2024, mes: 12, total: '50.00' },
      { ano: 2025, mes: 1, total: '300.00' },
      { ano: 2025, mes: 3, total: '1000.00' },
    ]);

    const filtrado = await http().get(`/parlamentares/${ids.ana.id}/gastos-mensais?ano=2024`);
    expect(filtrado.body).toHaveLength(1);
  });

  it('GET /meta/sync retorna a última sincronização bem-sucedida de cada fonte', async () => {
    const res = await http().get('/meta/sync').expect(200);
    // Fontes que nunca sincronizaram aparecem com null e não contam para "atualizadoEm"
    expect(syncStatusSchema.parse(res.body)).toEqual({
      fontes: [
        { fonte: 'camara:deputados', ultimaSincronizacao: '2026-11-17T07:04:00.000Z' },
        { fonte: 'camara:despesas', ultimaSincronizacao: '2026-11-19T10:02:00.000Z' },
        { fonte: 'senado:senadores', ultimaSincronizacao: null },
        { fonte: 'senado:despesas', ultimaSincronizacao: null },
        { fonte: 'transparencia:emendas', ultimaSincronizacao: null },
      ],
      atualizadoEm: '2026-11-17T07:04:00.000Z',
    });
  });

  it('documenta os endpoints no OpenAPI', async () => {
    const res = await http().get('/docs-json').expect(200);
    const doc = res.body as {
      paths: Record<string, { get: { parameters?: { name: string }[] } }>;
    };
    expect(Object.keys(doc.paths)).toEqual(
      expect.arrayContaining([
        '/parlamentares',
        '/parlamentares/{id}',
        '/parlamentares/{id}/despesas',
        '/parlamentares/{id}/gastos-mensais',
        '/parlamentares/{id}/emendas',
        '/parlamentares/{id}/pontos-de-atencao',
        '/meta/sync',
      ]),
    );
    const params = doc.paths['/parlamentares']?.get.parameters?.map((p) => p.name);
    expect(params).toEqual(expect.arrayContaining(['nome', 'partido', 'uf', 'page', 'pageSize']));
  });
});
