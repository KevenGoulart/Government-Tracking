import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { PrismaClient } from '@raio-x/db';
import { truncateAll } from '@raio-x/db/testing';
import { destaquesPontosAtencaoSchema, pontosAtencaoSchema } from '@raio-x/shared';
import type { Redis } from 'ioredis';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { setupApp } from '../src/app.setup';
import { REDIS } from '../src/common/redis.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Cenário com números escolhidos para conferir as regras à mão:
 * - Combustível: Bruno tem 60 despesas de R$ 100 a R$ 159; Ana tem R$ 120, R$ 5.000 e um
 *   estorno de -R$ 50 (fora do padrão). Mediana das 62 positivas: R$ 129,50.
 * - Ana também gasta R$ 60.000 com a gráfica e R$ 30.000 com uma agência (divulgação) e
 *   R$ 200.000 com a TAM (passagens, que ficam fora da concentração).
 */
async function cenario(prisma: PrismaClient) {
  await truncateAll(prisma);

  const parlamentar = (idExterno: string, nome: string) =>
    prisma.parlamentar.create({
      data: { casa: 'CAMARA', idExterno, nome, nomeBusca: nome.toLowerCase(), uf: 'SP' },
    });
  const [ana, bruno, carla] = await Promise.all([
    parlamentar('1', 'Ana'),
    parlamentar('2', 'Bruno'),
    parlamentar('3', 'Carla'),
  ]);

  const categoria = (slug: string) => prisma.categoria.create({ data: { slug, nome: slug } });
  const [combustivel, divulgacao, passagem] = await Promise.all([
    categoria('combustiveis-e-lubrificantes'),
    categoria('divulgacao-da-atividade-parlamentar'),
    categoria('passagem-aerea-sigepa'),
  ]);

  const fornecedor = (chave: string, nome: string, documento: string | null) =>
    prisma.fornecedor.create({ data: { chave, nome, nomeNormalizado: nome, documento } });
  const [posto, grafica, agencia, tam] = await Promise.all([
    fornecedor('nome:POSTO', 'Posto', null),
    fornecedor('04971874000147', 'Gráfica', '04971874000147'),
    fornecedor('11222333000181', 'Agência', '11222333000181'),
    fornecedor('02012862000160', 'TAM', '02012862000160'),
  ]);

  let seq = 0;
  const despesa = (
    parlamentarId: string,
    categoriaId: string,
    fornecedorId: string,
    valor: number,
  ) => ({
    idExterno: `t:${++seq}`,
    parlamentarId,
    categoriaId,
    fornecedorId,
    ano: 2025,
    mes: 1 + (seq % 12),
    valorDocumento: valor.toFixed(2),
    valorLiquido: valor.toFixed(2),
  });

  await prisma.despesa.createMany({
    data: [
      ...Array.from({ length: 60 }, (_, i) => despesa(bruno.id, combustivel.id, posto.id, 100 + i)),
      despesa(ana.id, combustivel.id, posto.id, 120),
      despesa(ana.id, combustivel.id, posto.id, 5000),
      despesa(ana.id, combustivel.id, posto.id, -50),
      despesa(ana.id, divulgacao.id, grafica.id, 60_000),
      despesa(ana.id, divulgacao.id, agencia.id, 30_000),
      despesa(ana.id, passagem.id, tam.id, 200_000),
    ],
  });

  return { ana, bruno, carla, grafica };
}

describe('Pontos de atenção (e2e)', () => {
  let app: INestApplication<App>;
  let ids: Awaited<ReturnType<typeof cenario>>;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    setupApp(app);
    await app.init();
    ids = await cenario(app.get(PrismaService));
    const redis = app.get<Redis>(REDIS);
    if (redis.status === 'wait') await redis.connect();
    await redis.flushdb();
  });

  afterAll(async () => {
    await app.close();
  });

  it('destaca a despesa atípica e a concentração, sem contar passagens', async () => {
    const res = await http().get(`/parlamentares/${ids.ana.id}/pontos-de-atencao`).expect(200);
    const body = pontosAtencaoSchema.parse(res.body);

    expect(body.ano).toBe(2025);
    expect(body.valoresAtipicos.quantidade).toBe(1);
    expect(body.valoresAtipicos.total).toBe('5000.00');
    const [atipica] = body.valoresAtipicos.data;
    expect(atipica?.valorLiquido).toBe('5000.00');
    expect(atipica?.referencia).toMatchObject({ mediana: '129.50', quantidadeCategoria: 62 });
    expect(atipica?.vezesMediana).toBe(38.6);

    // Base: 120 + 5.000 - 50 + 60.000 + 30.000 = 95.070 (a TAM ficaria em 1º se contasse)
    expect(body.concentracao).toEqual({
      fornecedor: { id: ids.grafica.id, nome: 'Gráfica', documento: '04971874000147' },
      total: '60000.00',
      totalBase: '95070.00',
      participacao: 0.631,
      quantidade: 1,
    });
  });

  it('não destaca nada dentro do padrão nem concentração abaixo do total mínimo', async () => {
    const res = await http().get(`/parlamentares/${ids.bruno.id}/pontos-de-atencao`).expect(200);
    expect(pontosAtencaoSchema.parse(res.body)).toEqual({
      ano: 2025,
      valoresAtipicos: { quantidade: 0, total: '0.00', data: [] },
      concentracao: null,
    });
  });

  it('responde vazio para quem não tem despesas e para anos sem dados', async () => {
    const semDespesas = await http().get(`/parlamentares/${ids.carla.id}/pontos-de-atencao`);
    expect(semDespesas.body).toMatchObject({ ano: null, concentracao: null });

    const outroAno = await http()
      .get(`/parlamentares/${ids.ana.id}/pontos-de-atencao?ano=2024`)
      .expect(200);
    expect(outroAno.body).toMatchObject({ ano: 2024, valoresAtipicos: { quantidade: 0 } });
  });

  it('destaques da casa: atípicas e concentrações de todos os parlamentares', async () => {
    const res = await http().get('/pontos-de-atencao?casa=CAMARA').expect(200);
    const body = destaquesPontosAtencaoSchema.parse(res.body);

    expect(body).toMatchObject({
      casa: 'CAMARA',
      ano: 2025,
      valoresAtipicos: { quantidade: 1, total: '5000.00' },
      concentracoes: { quantidade: 1 },
    });
    const [atipica] = body.valoresAtipicos.data;
    expect(atipica).toMatchObject({
      valorLiquido: '5000.00',
      vezesMediana: 38.6,
      parlamentar: { id: ids.ana.id, nome: 'Ana' },
    });
    expect(body.concentracoes.data).toHaveLength(1);
    expect(body.concentracoes.data[0]).toMatchObject({
      parlamentar: { id: ids.ana.id },
      fornecedor: { id: ids.grafica.id, nome: 'Gráfica', documento: '04971874000147' },
      total: '60000.00',
      totalBase: '95070.00',
      participacao: 0.631,
      quantidade: 1,
    });
  });

  it('destaques: vazio para casa sem despesas e 400 para casa inválida', async () => {
    const senado = await http().get('/pontos-de-atencao?casa=SENADO').expect(200);
    expect(senado.body).toEqual({
      casa: 'SENADO',
      ano: null,
      valoresAtipicos: { quantidade: 0, total: '0.00', data: [] },
      concentracoes: { quantidade: 0, data: [] },
    });
    await http().get('/pontos-de-atencao?casa=XYZ').expect(400);
  });

  it('responde 404 para parlamentar inexistente e 400 para ano inválido', async () => {
    await http().get('/parlamentares/cm00000000000000000000000/pontos-de-atencao').expect(404);
    await http().get(`/parlamentares/${ids.ana.id}/pontos-de-atencao?ano=1990`).expect(400);
  });
});
