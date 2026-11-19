import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  comparacaoSchema,
  estatisticasSchema,
  fornecedorDetalheSchema,
  rankingSchema,
} from '@raio-x/shared';
import type { Redis } from 'ioredis';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { setupApp } from '../src/app.setup';
import { REDIS } from '../src/common/redis.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { seed } from './seed';

describe('Rankings, estatísticas, fornecedores e comparação (e2e)', () => {
  let app: INestApplication<App>;
  let redis: Redis;
  let ids: Awaited<ReturnType<typeof seed>>;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    setupApp(app);
    await app.init();
    ids = await seed(app.get(PrismaService));
    redis = app.get<Redis>(REDIS);
    if (redis.status === 'wait') await redis.connect();
    await redis.flushdb();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /rankings', () => {
    it('ordena pelo total do ano mais recente', async () => {
      const res = await http().get('/rankings').expect(200);
      const body = rankingSchema.parse(res.body);
      expect(body.ano).toBe(2025);
      expect(body.data.map((i) => [i.posicao, i.parlamentar.nome, i.total, i.quantidade])).toEqual([
        [1, 'Ana Lúcia Souza', '1300.00', 3],
        [2, 'Bruno Carvalho', '250.00', 2],
      ]);
      expect(body.meta.total).toBe(2);
    });

    it.each([
      ['partido', { partido: 'pl' }, [['Bruno Carvalho', '250.00']]],
      ['UF', { uf: 'SP' }, [['Ana Lúcia Souza', '1300.00']]],
      [
        'categoria',
        { categoria: 'combustiveis-e-lubrificantes' },
        [
          ['Ana Lúcia Souza', '300.00'],
          ['Bruno Carvalho', '250.00'],
        ],
      ],
      ['ano', { ano: 2024 }, [['Ana Lúcia Souza', '50.00']]],
    ])('filtra por %s', async (_filtro, query, esperado) => {
      const res = await http().get('/rankings').query(query).expect(200);
      expect(rankingSchema.parse(res.body).data.map((i) => [i.parlamentar.nome, i.total])).toEqual(
        esperado,
      );
    });

    it('separa Câmara e Senado (padrão: Câmara)', async () => {
      const senado = rankingSchema.parse(
        (await http().get('/rankings?casa=SENADO').expect(200)).body,
      );
      expect(senado).toMatchObject({ casa: 'SENADO', ano: 2025 });
      expect(senado.data.map((i) => [i.parlamentar.nome, i.total])).toEqual([
        ['Davi Senador', '900.00'],
      ]);
      const camara = rankingSchema.parse((await http().get('/rankings').expect(200)).body);
      expect(camara.data.some((i) => i.parlamentar.casa === 'SENADO')).toBe(false);
    });

    it('numera as posições considerando a página', async () => {
      const res = await http().get('/rankings?pageSize=1&page=2').expect(200);
      const body = rankingSchema.parse(res.body);
      expect(body.data.map((i) => i.posicao)).toEqual([2]);
      expect(body.meta.totalPages).toBe(2);
    });
  });

  describe('GET /estatisticas', () => {
    it('retorna totais, categorias, estados e maiores gastos do ano', async () => {
      const res = await http().get('/estatisticas').expect(200);
      expect(estatisticasSchema.parse(res.body)).toEqual({
        casa: 'CAMARA',
        ano: 2025,
        anosDisponiveis: [2025, 2024],
        total: '1550.00',
        quantidadeDespesas: 5,
        quantidadeParlamentares: 2,
        quantidadeFornecedores: 2,
        porCategoria: [
          expect.objectContaining({
            slug: 'divulgacao-da-atividade-parlamentar',
            total: '1000.00',
          }),
          expect.objectContaining({ slug: 'combustiveis-e-lubrificantes', total: '550.00' }),
        ],
        porUf: [
          { uf: 'SP', total: '1300.00', parlamentares: 1, mediaPorParlamentar: '1300.00' },
          { uf: 'RJ', total: '250.00', parlamentares: 1, mediaPorParlamentar: '250.00' },
        ],
        maioresGastos: [
          expect.objectContaining({ posicao: 1, total: '1300.00' }),
          expect.objectContaining({ posicao: 2, total: '250.00' }),
        ],
      });
    });

    it('calcula as estatísticas do Senado separadamente', async () => {
      const res = await http().get('/estatisticas?casa=SENADO').expect(200);
      expect(estatisticasSchema.parse(res.body)).toMatchObject({
        casa: 'SENADO',
        ano: 2025,
        anosDisponiveis: [2025],
        total: '900.00',
        quantidadeParlamentares: 1,
        porCategoria: [{ slug: 'senado-aluguel-de-imoveis', total: '900.00' }],
        porUf: [{ uf: 'AP', total: '900.00' }],
      });
    });

    it('guarda a resposta no cache do Redis', async () => {
      await http().get('/estatisticas?ano=2024').expect(200);
      const chaves = await redis.keys('cache:*:*:estatisticas:CAMARA:2024');
      expect(chaves).toHaveLength(1);
      expect(await redis.ttl(chaves[0] as string)).toBeGreaterThan(0);
    });

    it('serve do cache em chamadas seguintes', async () => {
      const primeira = await http().get('/estatisticas?ano=2024').expect(200);
      const [chave] = await redis.keys('cache:*:*:estatisticas:CAMARA:2024');
      // Altera o valor guardado: a segunda resposta tem que vir do cache, não do banco
      await redis.set(chave as string, JSON.stringify({ ...primeira.body, total: '999.00' }));
      const segunda = await http().get('/estatisticas?ano=2024').expect(200);
      expect((segunda.body as { total: string }).total).toBe('999.00');
    });
  });

  describe('GET /fornecedores/:documento', () => {
    it.each(['04971874000147', '04.971.874/0001-47'])(
      'encontra pelo CNPJ (%s) e soma todos os anos',
      async (documento) => {
        const res = await http()
          .get(`/fornecedores/${encodeURIComponent(documento)}`)
          .expect(200);
        const body = fornecedorDetalheSchema.parse(res.body);
        expect(body).toMatchObject({
          nome: 'POSTO NATIVUS LTDA',
          documento: '04971874000147',
          tipoDocumento: 'CNPJ',
          ano: null,
          total: '600.00',
          quantidade: 5,
          quantidadeParlamentares: 2,
          anosDisponiveis: [
            { ano: 2025, total: '550.00' },
            { ano: 2024, total: '50.00' },
          ],
        });
        expect(body.parlamentares.map((p) => [p.parlamentar.nome, p.total])).toEqual([
          ['Ana Lúcia Souza', '350.00'],
          ['Bruno Carvalho', '250.00'],
        ]);
      },
    );

    it('filtra por ano', async () => {
      const res = await http().get('/fornecedores/04971874000147?ano=2024').expect(200);
      expect(fornecedorDetalheSchema.parse(res.body)).toMatchObject({ ano: 2024, total: '50.00' });
    });

    it('encontra fornecedor sem documento pelo id', async () => {
      const res = await http().get(`/fornecedores/${ids.grafica.id}`).expect(200);
      expect(fornecedorDetalheSchema.parse(res.body)).toMatchObject({
        nome: 'Gráfica X',
        documento: null,
        tipoDocumento: null,
        total: '1000.00',
      });
    });

    it.each(['11111111111111', 'abc', '04971874000148'])('responde 404 para %s', async (doc) => {
      await http().get(`/fornecedores/${doc}`).expect(404);
    });
  });

  describe('GET /comparacao', () => {
    it('compara parlamentares mantendo a ordem pedida', async () => {
      const res = await http().get(`/comparacao?ids=${ids.bruno.id},${ids.ana.id}`).expect(200);
      const body = comparacaoSchema.parse(res.body);
      expect(body.ano).toBe(2025);
      expect(body.parlamentares.map((p) => [p.parlamentar.nome, p.total, p.quantidade])).toEqual([
        ['Bruno Carvalho', '250.00', 2],
        ['Ana Lúcia Souza', '1300.00', 3],
      ]);
      expect(body.parlamentares[1]?.mensal).toEqual([
        { ano: 2025, mes: 1, total: '300.00' },
        { ano: 2025, mes: 3, total: '1000.00' },
      ]);
      expect(body.parlamentares[1]?.categorias).toHaveLength(2);
    });

    it('inclui quem não tem despesas no ano com total zero', async () => {
      const res = await http().get(`/comparacao?ids=${ids.ana.id},${ids.carla.id}`).expect(200);
      expect(comparacaoSchema.parse(res.body).parlamentares[1]).toMatchObject({
        total: '0.00',
        quantidade: 0,
        categorias: [],
        mensal: [],
      });
    });

    it('exige de 2 a 4 parlamentares', async () => {
      await http().get(`/comparacao?ids=${ids.ana.id}`).expect(400);
      await http().get('/comparacao').expect(400);
    });

    it('não compara parlamentares de casas diferentes', async () => {
      const res = await http().get(`/comparacao?ids=${ids.ana.id},${ids.davi.id}`).expect(400);
      expect((res.body as { message: string }).message).toMatch(/mesma casa/);
    });

    it('responde 404 quando algum parlamentar não existe', async () => {
      await http().get(`/comparacao?ids=${ids.ana.id},cl0000000000000000000000`).expect(404);
    });
  });
});
