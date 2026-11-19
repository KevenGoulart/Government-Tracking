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
  {
    id: 'cmdavi000000000000000000d4',
    casa: 'SENADO',
    nome: 'Davi Senador',
    partido: 'PSD',
    uf: 'AP',
    fotoUrl: null,
    emExercicio: true,
  },
];

const categoriasSenado = [{ slug: 'senado-aluguel-de-imoveis', nome: 'Aluguel de imóveis' }];

const emendasAna = {
  ano: 2025,
  anosDisponiveis: [{ ano: 2025, empenhado: '4000.00', pago: '3400.00', quantidade: 2 }],
  totais: { empenhado: '4000.00', pago: '3400.00', quantidade: 2 },
  porFuncao: [
    { funcao: 'Educação', empenhado: '3000.00', pago: '3000.00', quantidade: 1 },
    { funcao: 'Saúde', empenhado: '1000.00', pago: '400.00', quantidade: 1 },
  ],
  porLocalidade: [
    { localidade: 'CAMPINAS - SP', empenhado: '3000.00', pago: '3000.00', quantidade: 1 },
    { localidade: 'SÃO PAULO - SP', empenhado: '1000.00', pago: '400.00', quantidade: 1 },
  ],
  data: [
    {
      id: 'cmemenda000000000000000e2',
      codigo: '202500000002',
      ano: 2025,
      numero: '0002',
      tipo: 'Emenda Individual - Transferências Especiais',
      observacaoAutor: null,
      localidade: 'CAMPINAS - SP',
      funcao: 'Educação',
      subfuncao: 'Ensino fundamental',
      valorEmpenhado: '3000.00',
      valorLiquidado: '3000.00',
      valorPago: '3000.00',
    },
    {
      id: 'cmemenda000000000000000e1',
      codigo: '202500000001',
      ano: 2025,
      numero: '0001',
      tipo: 'Emenda Individual - Transferências com Finalidade Definida',
      observacaoAutor: null,
      localidade: 'SÃO PAULO - SP',
      funcao: 'Saúde',
      subfuncao: 'Atenção básica',
      valorEmpenhado: '1000.00',
      valorLiquidado: '400.00',
      valorPago: '400.00',
    },
  ],
  meta: { page: 1, pageSize: 10, total: 2, totalPages: 1 },
};

const semEmendas = {
  ano: null,
  anosDisponiveis: [],
  totais: { empenhado: '0.00', pago: '0.00', quantidade: 0 },
  porFuncao: [],
  porLocalidade: [],
  data: [],
  meta: { page: 1, pageSize: 10, total: 0, totalPages: 1 },
};

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

// Pontos de atenção da Ana: uma despesa atípica e concentração no posto (sem passagens)
const pontosAna = {
  ano: 2025,
  valoresAtipicos: {
    quantidade: 1,
    total: '100.00',
    data: [
      {
        ...despesasAna[0],
        referencia: { mediana: '25.00', limite: '90.00', quantidadeCategoria: 120 },
        vezesMediana: 4,
      },
    ],
  },
  concentracao: {
    fornecedor: {
      id: 'cmforn000000000000000posto',
      nome: 'POSTO NATIVUS LTDA',
      documento: '04971874000147',
    },
    total: '2000.00',
    totalBase: '2000.00',
    participacao: 1,
    quantidade: 20,
  },
};

const semPontos = {
  ano: 2025,
  valoresAtipicos: { quantidade: 0, total: '0.00', data: [] },
  concentracao: null,
};

const ranking = [
  { posicao: 1, parlamentar: parlamentares[0], total: '7000.00', quantidade: 25 },
  { posicao: 2, parlamentar: parlamentares[1], total: '250.00', quantidade: 2 },
];

const rankingSenado = [
  { posicao: 1, parlamentar: parlamentares[3], total: '900.00', quantidade: 1 },
];

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
  if (caminho === '/categorias') {
    if (p.get('casa') === 'SENADO') return json(res, 200, categoriasSenado);
    return json(
      res,
      200,
      p.get('casa') === 'CAMARA' ? categorias : [...categorias, ...categoriasSenado],
    );
  }
  if (caminho === '/parlamentares/filtros') {
    return json(res, 200, { partidos: ['PL', 'PSD', 'PT'], ufs: ['AP', 'MG', 'RJ', 'SP'] });
  }
  if (caminho === '/parlamentares') {
    const nome = p.get('nome');
    const filtrados = parlamentares.filter(
      (x) =>
        (!nome || semAcento(x.nome).includes(semAcento(nome))) &&
        (!p.get('casa') || x.casa === p.get('casa')) &&
        (!p.get('partido') || x.partido === p.get('partido')) &&
        (!p.get('uf') || x.uf === p.get('uf')),
    );
    return json(res, 200, paginar(filtrados, p));
  }
  if (caminho === '/estatisticas' && p.get('casa') === 'SENADO') {
    return json(res, 200, {
      casa: 'SENADO',
      ano: 2025,
      anosDisponiveis: [2025],
      total: '900.00',
      quantidadeDespesas: 1,
      quantidadeParlamentares: 1,
      quantidadeFornecedores: 1,
      porCategoria: [{ ...categoriasSenado[0], total: '900.00' }],
      porUf: [{ uf: 'AP', total: '900.00', parlamentares: 1, mediaPorParlamentar: '900.00' }],
      maioresGastos: rankingSenado,
    });
  }
  if (caminho === '/estatisticas') {
    return json(res, 200, {
      casa: 'CAMARA',
      ano: Number(p.get('ano') ?? 2025),
      anosDisponiveis: [2025, 2024],
      total: '7250.00',
      quantidadeDespesas: 27,
      quantidadeParlamentares: 2,
      quantidadeFornecedores: 2,
      porCategoria: detalheAna.resumo.categorias,
      porUf: [
        { uf: 'SP', total: '7000.00', parlamentares: 1, mediaPorParlamentar: '7000.00' },
        { uf: 'RJ', total: '250.00', parlamentares: 1, mediaPorParlamentar: '250.00' },
      ],
      maioresGastos: ranking,
    });
  }
  if (caminho === '/rankings') {
    const casa = p.get('casa') ?? 'CAMARA';
    const filtrado = (casa === 'SENADO' ? rankingSenado : ranking).filter(
      (i) =>
        (!p.get('uf') || i.parlamentar?.uf === p.get('uf')) &&
        (!p.get('partido') || i.parlamentar?.partido === p.get('partido')),
    );
    const pagina = paginar(
      filtrado.map((i, n) => ({ ...i, posicao: n + 1 })),
      p,
    );
    return json(res, 200, { casa, ano: Number(p.get('ano') ?? 2025), ...pagina });
  }
  if (caminho === '/fornecedores/02012862000160') {
    return json(res, 200, {
      id: 'cmforn0000000000000000tam',
      nome: 'TAM',
      documento: '02012862000160',
      tipoDocumento: 'CNPJ',
      ano: p.get('ano') ? Number(p.get('ano')) : null,
      anosDisponiveis: [{ ano: 2025, total: '5000.00' }],
      total: '5000.00',
      quantidade: 5,
      quantidadeParlamentares: 1,
      parlamentares: [{ parlamentar: parlamentares[0], total: '5000.00', quantidade: 5 }],
      categorias: [detalheAna.resumo.categorias[0]],
    });
  }
  if (caminho.startsWith('/fornecedores/')) {
    return json(res, 404, { statusCode: 404, message: 'Fornecedor não encontrado' });
  }
  if (caminho === '/comparacao') {
    const ids = (p.get('ids') ?? '').split(',').filter(Boolean);
    const escolhidos = ids.map((id) => parlamentares.find((x) => x.id === id));
    if (ids.length < 2) return json(res, 400, { message: 'Parâmetros inválidos' });
    if (escolhidos.some((x) => !x)) return json(res, 404, { message: 'Não encontrado' });
    return json(res, 200, {
      ano: Number(p.get('ano') ?? 2025),
      parlamentares: escolhidos.map((x, i) => ({
        parlamentar: x,
        total: i === 0 ? '7000.00' : '250.00',
        quantidade: i === 0 ? 25 : 2,
        categorias: i === 0 ? detalheAna.resumo.categorias : [detalheAna.resumo.categorias[1]],
        mensal: [
          { ano: 2025, mes: 1, total: i === 0 ? '2700.00' : '250.00' },
          { ano: 2025, mes: 2, total: i === 0 ? '4300.00' : '0.00' },
        ],
      })),
    });
  }

  const rotaEmendas = /^\/parlamentares\/([^/]+)\/emendas$/.exec(caminho);
  if (rotaEmendas) {
    return json(res, 200, rotaEmendas[1] === detalheAna.id ? emendasAna : semEmendas);
  }

  const rotaPontos = /^\/parlamentares\/([^/]+)\/pontos-de-atencao$/.exec(caminho);
  if (rotaPontos) {
    return json(res, 200, rotaPontos[1] === detalheAna.id ? pontosAna : semPontos);
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
        idExterno: outro.casa === 'SENADO' ? '5000' : '9',
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
