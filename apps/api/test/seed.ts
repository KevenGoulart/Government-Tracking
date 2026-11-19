import type { PrismaClient } from '@raio-x/db';
import { truncateAll } from '@raio-x/db/testing';

/** Dados mínimos e conhecidos para os testes e2e (valores escolhidos para facilitar as somas). */
export async function seed(prisma: PrismaClient) {
  await truncateAll(prisma);

  const [ana, bruno, carla] = await Promise.all([
    prisma.parlamentar.create({
      data: {
        casa: 'CAMARA',
        idExterno: '1001',
        nome: 'Ana Lúcia Souza',
        nomeBusca: 'ana lucia souza',
        nomeCivil: 'ANA LÚCIA SOUZA',
        partido: 'PT',
        uf: 'SP',
        emExercicio: true,
      },
    }),
    prisma.parlamentar.create({
      data: {
        casa: 'CAMARA',
        idExterno: '1002',
        nome: 'Bruno Carvalho',
        nomeBusca: 'bruno carvalho',
        partido: 'PL',
        uf: 'RJ',
        emExercicio: true,
      },
    }),
    prisma.parlamentar.create({
      data: {
        casa: 'CAMARA',
        idExterno: '1003',
        nome: 'Carla Antunes',
        nomeBusca: 'carla antunes',
        partido: 'PT',
        uf: 'MG',
        emExercicio: false,
      },
    }),
  ]);

  const [combustivel, divulgacao] = await Promise.all([
    prisma.categoria.create({
      data: { slug: 'combustiveis-e-lubrificantes', nome: 'COMBUSTÍVEIS E LUBRIFICANTES' },
    }),
    prisma.categoria.create({
      data: {
        slug: 'divulgacao-da-atividade-parlamentar',
        nome: 'DIVULGAÇÃO DA ATIVIDADE PARLAMENTAR',
      },
    }),
  ]);

  const [posto, grafica] = await Promise.all([
    prisma.fornecedor.create({
      data: {
        chave: '04971874000147',
        documento: '04971874000147',
        nome: 'POSTO NATIVUS LTDA',
        nomeNormalizado: 'POSTO NATIVUS LTDA',
      },
    }),
    prisma.fornecedor.create({
      data: { chave: 'nome:GRAFICA X', nome: 'Gráfica X', nomeNormalizado: 'GRAFICA X' },
    }),
  ]);

  let seq = 0;
  const despesa = (
    parlamentarId: string,
    ano: number,
    mes: number,
    valor: string,
    categoriaId: string,
    fornecedorId: string,
    dia = 10,
  ) => ({
    idExterno: `teste:${++seq}`,
    parlamentarId,
    ano,
    mes,
    dataDocumento: new Date(Date.UTC(ano, mes - 1, dia)),
    categoriaId,
    fornecedorId,
    tipoDocumento: 'Nota Fiscal',
    numDocumento: String(seq),
    valorDocumento: valor,
    valorGlosa: '0',
    valorLiquido: valor,
    urlDocumento: `https://www.camara.leg.br/doc/${seq}.pdf`,
  });

  await prisma.despesa.createMany({
    data: [
      // Ana, 2025: 100 + 200 (combustível, janeiro) + 1000 (divulgação, março) = 1300
      despesa(ana.id, 2025, 1, '100.00', combustivel.id, posto.id, 5),
      despesa(ana.id, 2025, 1, '200.00', combustivel.id, posto.id, 20),
      despesa(ana.id, 2025, 3, '1000.00', divulgacao.id, grafica.id),
      // Ana, 2024: 50
      despesa(ana.id, 2024, 12, '50.00', combustivel.id, posto.id),
      // Bruno, 2025: 300 com um estorno de -50 = 250
      despesa(bruno.id, 2025, 2, '300.00', combustivel.id, posto.id),
      despesa(bruno.id, 2025, 2, '-50.00', combustivel.id, posto.id),
    ],
  });

  await prisma.syncRun.createMany({
    data: [
      {
        fonte: 'camara:deputados',
        status: 'SUCCESS',
        inicio: new Date('2026-11-17T07:00:00Z'),
        fim: new Date('2026-11-17T07:04:00Z'),
        processados: 3,
      },
      {
        fonte: 'camara:despesas',
        status: 'SUCCESS',
        inicio: new Date('2026-11-19T10:00:00Z'),
        fim: new Date('2026-11-19T10:02:00Z'),
        processados: 6,
      },
      {
        fonte: 'camara:despesas',
        status: 'FAILED',
        inicio: new Date('2026-11-19T11:00:00Z'),
        fim: new Date('2026-11-19T11:00:05Z'),
        erro: 'timeout',
      },
    ],
  });

  return { ana, bruno, carla, posto, grafica };
}
