/**
 * API falsa para os testes e2e do front-end: responde com dados fixos no mesmo formato
 * da API real (schemas de @raio-x/shared), sem depender de Postgres ou da ingestão.
 * Executada diretamente pelo Node (type stripping): `node e2e/mock-api.ts`.
 */
import { createServer, type ServerResponse } from 'node:http';

const PORTA = Number(process.env.MOCK_API_PORT ?? 3101);

const parlamentares = [
  {
    id: 'cmana0000000000000000000a1',
    casa: 'CAMARA',
    nome: 'Ana Lúcia Souza',
    partido: 'PT',
    uf: 'SP',
    fotoUrl: null,
    emExercicio: true,
  },
  {
    id: 'cmbruno00000000000000000b2',
    casa: 'CAMARA',
    nome: 'Bruno Carvalho',
    partido: 'PL',
    uf: 'RJ',
    fotoUrl: null,
    emExercicio: true,
  },
  {
    id: 'cmcarla00000000000000000c3',
    casa: 'CAMARA',
    nome: 'Carla Antunes',
    partido: 'PT',
    uf: 'MG',
    fotoUrl: null,
    emExercicio: false,
  },
];

const categorias = [
  { slug: 'combustiveis-e-lubrificantes', nome: 'COMBUSTÍVEIS E LUBRIFICANTES' },
  { slug: 'passagem-aerea-sigepa', nome: 'PASSAGEM AÉREA - SIGEPA' },
];

// 25 despesas da Ana em 2025: 20 de combustível (R$ 100) e 5 passagens (R$ 1.000)
const despesasAna = Array.from({ length: 25 }, (_, i) => {
  const passagem = i >= 20;
  const mes = (i % 3) + 1;
  return {
    id: `cmdesp${String(i).padStart(20, '0')}`,
    ano: 2025,
    mes,
    dataDocumento: `2025-0${mes}-${String(28 - i).padStart(2, '0')}`,
    categoria: passagem ? categorias[1] : categorias[0],
    fornecedor: passagem
      ? { id: 'cmforn0000000000000000tam', nome: 'TAM', documento: '02012862000160' }
      : {
          id: 'cmforn000000000000000posto',
          nome: 'POSTO NATIVUS LTDA',
          documento: '04971874000147',
        },
    tipoDocumento: 'Nota Fiscal',
    numDocumento: String(i),
    valorDocumento: passagem ? '1000.00' : '100.00',
    valorGlosa: '0.00',
    valorLiquido: passagem ? '1000.00' : '100.00',
    urlDocumento: passagem ? null : `https://www.camara.leg.br/doc/${i}.pdf`,
  };
});

const detalheAna = {
  ...parlamentares[0],
  idExterno: '1001',
  nomeCivil: 'ANA LÚCIA SOUZA',
  email: null,
  resumo: {
    anoReferencia: 2025,
    anosDisponiveis: [
      { ano: 2025, total: '7000.00', quantidade: 25 },
      { ano: 2024, total: '50.00', quantidade: 1 },
    ],
    totalAno: '7000.00',
    categorias: [
      { slug: 'passagem-aerea-sigepa', nome: 'PASSAGEM AÉREA - SIGEPA', total: '5000.00' },
      {
        slug: 'combustiveis-e-lubrificantes',
        nome: 'COMBUSTÍVEIS E LUBRIFICANTES',
        total: '2000.00',
      },
    ],
    fornecedores: [
      {
        id: 'cmforn0000000000000000tam',
        nome: 'TAM',
        documento: '02012862000160',
        total: '5000.00',
      },
      {
        id: 'cmforn000000000000000posto',
        nome: 'POSTO NATIVUS LTDA',
        documento: '04971874000147',
        total: '2000.00',
      },
    ],
  },
};

const semAcento = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

function paginar<T>(itens: T[], params: URLSearchParams) {
  const page = Number(params.get('page') ?? 1);
  const pageSize = Number(params.get('pageSize') ?? 20);
  return {
    data: itens.slice((page - 1) * pageSize, page * pageSize),
    meta: {
      page,
      pageSize,
      total: itens.length,
      totalPages: Math.max(1, Math.ceil(itens.length / pageSize)),
    },
  };
}

function json(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORTA}`);
  const p = url.searchParams;
  const caminho = url.pathname;

  if (caminho === '/meta/sync') {
    return json(res, 200, {
      fontes: [
        { fonte: 'camara:deputados', ultimaSincronizacao: '2026-11-19T10:00:00.000Z' },
        { fonte: 'camara:despesas', ultimaSincronizacao: '2026-11-19T10:02:00.000Z' },
      ],
      atualizadoEm: '2026-11-19T10:00:00.000Z',
    });
  }
  if (caminho === '/categorias') return json(res, 200, categorias);
  if (caminho === '/parlamentares/filtros') {
    return json(res, 200, { partidos: ['PL', 'PT'], ufs: ['MG', 'RJ', 'SP'] });
  }
  if (caminho === '/parlamentares') {
    const nome = p.get('nome');
    const filtrados = parlamentares.filter(
      (x) =>
        (!nome || semAcento(x.nome).includes(semAcento(nome))) &&
        (!p.get('partido') || x.partido === p.get('partido')) &&
        (!p.get('uf') || x.uf === p.get('uf')),
    );
    return json(res, 200, paginar(filtrados, p));
  }

  const rota = /^\/parlamentares\/([^/]+)(\/despesas|\/gastos-mensais)?$/.exec(caminho);
  if (rota) {
    const [, id, sub] = rota;
    if (id === detalheAna.id) {
      if (!sub) return json(res, 200, detalheAna);
      if (sub === '/gastos-mensais') {
        return json(res, 200, [
          { ano: 2025, mes: 1, total: '2700.00' },
          { ano: 2025, mes: 2, total: '2400.00' },
          { ano: 2025, mes: 3, total: '1900.00' },
        ]);
      }
      const mes = p.get('mes');
      const categoria = p.get('categoria');
      let lista = despesasAna.filter(
        (d) => (!mes || d.mes === Number(mes)) && (!categoria || d.categoria?.slug === categoria),
      );
      if (p.get('ordenarPor') === 'valor') {
        lista = [...lista].sort((a, b) => Number(a.valorLiquido) - Number(b.valorLiquido));
        if (p.get('ordem') !== 'asc') lista.reverse();
      }
      return json(res, 200, paginar(lista, p));
    }
    const outro = parlamentares.find((x) => x.id === id);
    if (outro && !sub) {
      return json(res, 200, {
        ...outro,
        idExterno: '9',
        nomeCivil: null,
        email: null,
        resumo: {
          anoReferencia: null,
          anosDisponiveis: [],
          totalAno: '0.00',
          categorias: [],
          fornecedores: [],
        },
      });
    }
    return json(res, 404, { statusCode: 404, message: 'Parlamentar não encontrado' });
  }

  return json(res, 404, { statusCode: 404, message: 'Rota não encontrada' });
}).listen(PORTA, () => {
  process.stdout.write(`API falsa em http://localhost:${PORTA}
`);
});
