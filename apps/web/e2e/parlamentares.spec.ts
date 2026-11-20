import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';

const ANA = '/parlamentares/cmana0000000000000000000a1';

async function semViolacoesDeAcessibilidade(page: Page) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(
    violations.map(
      (v) =>
        `${v.id}: ${v.help} -> ${v.nodes.map((n) => `${n.target.join(' ')} [${n.failureSummary ?? ''}]`).join(' | ')}`,
    ),
  ).toEqual([]);
}

test.describe('busca de parlamentares', () => {
  test('lista parlamentares e busca por nome, refletindo o filtro na URL', async ({ page }) => {
    await page.goto('/parlamentares');
    await expect(page.getByRole('heading', { name: 'Parlamentares', exact: true })).toBeVisible();
    await expect(page.getByText('4 parlamentares encontrados')).toBeVisible();

    await page.getByLabel('Nome').fill('ana lucia');
    await page.getByRole('button', { name: 'Buscar' }).click();

    await expect(page).toHaveURL(/nome=ana\+lucia/);
    await expect(page.getByText('1 parlamentar encontrado')).toBeVisible();
    await expect(page.getByRole('link', { name: /Ana Lúcia Souza/ })).toBeVisible();
  });

  test('abre um link compartilhado com filtros já aplicados', async ({ page }) => {
    await page.goto('/parlamentares?uf=RJ');
    await expect(page.getByLabel('UF')).toHaveValue('RJ');
    await expect(page.getByRole('link', { name: /Bruno Carvalho/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /Ana Lúcia/ })).toHaveCount(0);
  });

  test('mostra estado vazio e permite limpar filtros', async ({ page }) => {
    await page.goto('/parlamentares?nome=inexistente');
    await expect(page.getByText(/Nenhum parlamentar encontrado/)).toBeVisible();
    await page.getByRole('link', { name: 'Limpar' }).click();
    await expect(page).toHaveURL(/\/parlamentares$/);
  });

  test('ignora parâmetros inválidos na URL', async ({ page }) => {
    await page.goto('/parlamentares?uf=XX&page=abc');
    await expect(page.getByText('4 parlamentares encontrados')).toBeVisible();
  });

  test('não tem violações de acessibilidade', async ({ page }) => {
    await page.goto('/parlamentares');
    await semViolacoesDeAcessibilidade(page);
  });
});

test.describe('página do parlamentar', () => {
  test('mostra dados, resumo do ano, gráficos e fornecedores', async ({ page }) => {
    await page.goto(ANA);

    await expect(page.getByRole('heading', { level: 1, name: 'Ana Lúcia Souza' })).toBeVisible();
    await expect(page).toHaveTitle(/Ana Lúcia Souza/);
    await expect(page.getByText('Nome civil: ANA LÚCIA SOUZA')).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Cota parlamentar (CEAP) em 2025' }),
    ).toBeVisible();
    await expect(page.getByText(/R\$\s7\.000,00/).first()).toBeVisible();

    // Gráfico mensal com tabela equivalente para leitores de tela
    await expect(page.getByRole('table', { name: /Gasto mensal em 2025/ })).toBeAttached();
    // Categorias em caixa de frase, preservando siglas
    await expect(page.getByRole('link', { name: /Passagem aérea - SIGEPA/ })).toBeVisible();
    await expect(page.getByText('02.012.862/0001-60').first()).toBeVisible();

    const perfil = page.getByRole('link', { name: /Perfil no site da Câmara/ });
    await expect(perfil).toHaveAttribute('href', 'https://www.camara.leg.br/deputados/1001');
  });

  test('lista despesas com link para a nota fiscal e paginação', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(ANA);

    const tabela = page.getByRole('table', { name: /Despesas da cota parlamentar/ });
    await expect(tabela.getByRole('row')).toHaveCount(21); // cabeçalho + 20
    await expect(tabela.getByRole('link', { name: /Nota fiscal/ }).first()).toHaveAttribute(
      'href',
      /camara\.leg\.br\/doc\//,
    );

    await page.getByRole('link', { name: 'Próxima' }).click();
    await expect(page).toHaveURL(/page=2/);
    await expect(tabela.getByRole('row')).toHaveCount(6); // cabeçalho + 5
    await expect(page.getByText('Página 2 de 2')).toBeVisible();
  });

  test('filtra despesas por categoria clicando no gráfico', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(ANA);
    await page.getByRole('link', { name: /Passagem aérea - SIGEPA/ }).click();

    await expect(page).toHaveURL(/categoria=passagem-aerea-sigepa/);
    await expect(page.getByLabel('Categoria')).toHaveValue('passagem-aerea-sigepa');
    const tabela = page.getByRole('table', { name: /Despesas da cota parlamentar/ });
    await expect(tabela.getByRole('row')).toHaveCount(6);
    await expect(tabela.getByText('Comprovante não publicado').first()).toBeVisible();
  });

  test('ordena e filtra pelo formulário', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(ANA);
    await page.getByLabel('Ordenar por').selectOption('valor-desc');
    await page.getByLabel('Mês').selectOption('2');
    await page.getByRole('button', { name: 'Filtrar' }).click();

    await expect(page).toHaveURL(/mes=2/);
    await expect(page).toHaveURL(/ordenacao=valor-desc/);
    const primeiraLinha = page
      .getByRole('table', { name: /Despesas da cota parlamentar/ })
      .getByRole('row')
      .nth(1);
    await expect(primeiraLinha).toContainText('R$ 1.000,00');
  });

  test('mostra mensagem para parlamentar sem despesas', async ({ page }) => {
    await page.goto('/parlamentares/cmcarla00000000000000000c3');
    await expect(page.getByText(/Não há despesas da cota parlamentar/)).toBeVisible();
  });

  test('responde com página de não encontrado para id inexistente', async ({ page }) => {
    const resposta = await page.goto('/parlamentares/cmnaoexiste0000000000000zz');
    expect(resposta?.status()).toBe(404);
    await expect(page.getByRole('heading', { name: 'Parlamentar não encontrado' })).toBeVisible();
  });

  test('não tem violações de acessibilidade (claro e escuro)', async ({ page }) => {
    await page.goto(ANA);
    await semViolacoesDeAcessibilidade(page);
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.reload();
    await semViolacoesDeAcessibilidade(page);
  });
});

test('todas as páginas mostram a fonte oficial e a data da sincronização', async ({ page }) => {
  await page.goto('/');
  const rodape = page.getByRole('contentinfo');
  await expect(rodape.getByRole('link', { name: /Dados Abertos da Câmara/ })).toBeVisible();
  await expect(rodape).toContainText('Dados sincronizados em 19/11/2026');
});

test('nenhuma página rola na horizontal no celular', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const url of [
    '/',
    '/?casa=SENADO',
    '/parlamentares',
    ANA,
    '/parlamentares/cmdavi000000000000000000d4',
    '/ranking',
    '/fornecedores/02012862000160',
    '/comparar?ids=cmana0000000000000000000a1,cmbruno00000000000000000b2',
  ]) {
    await page.goto(url);
    const largura = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(largura, url).toBeLessThanOrEqual(390);
  }
});

test('alterna o tema escuro', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Alternar tema claro/escuro' }).click();
  await expect(page.locator('html')).toHaveClass(/dark/);
});

test.describe('estatísticas, ranking, fornecedor e comparação', () => {
  const BRUNO = 'cmbruno00000000000000000b2';

  test('home mostra totais e leva ao ranking por categoria', async ({ page }) => {
    await page.goto('/');
    await expect(
      page.getByRole('heading', { name: 'Cota parlamentar (CEAP) em 2025' }),
    ).toBeVisible();
    await expect(page.getByText(/R\$\s7\.250,00/)).toBeVisible();
    await expect(page.getByRole('table', { name: 'Maiores totais de 2025' })).toBeVisible();

    await page.getByRole('link', { name: /Passagem aérea - SIGEPA/ }).click();
    await expect(page).toHaveURL(/\/ranking\?casa=CAMARA&ano=2025&categoria=passagem-aerea-sigepa/);
  });

  test('ranking aplica filtros pelo formulário', async ({ page }) => {
    await page.goto('/ranking');
    await expect(page.getByRole('heading', { name: 'Ranking de gastos' })).toBeVisible();
    const tabela = page.getByRole('table', { name: /Ranking de gastos de 2025 \(Câmara\)/ });
    await expect(tabela.getByRole('row')).toHaveCount(3);

    await page.getByLabel('UF').selectOption('RJ');
    await page.getByRole('button', { name: 'Aplicar' }).click();

    await expect(page).toHaveURL(/uf=RJ/);
    await expect(tabela.getByRole('row')).toHaveCount(2);
    await expect(tabela).toContainText('Bruno Carvalho');
    await expect(page.getByLabel('UF')).toHaveValue('RJ');
  });

  test('fornecedor: chega pela página do parlamentar e lista quem pagou', async ({ page }) => {
    await page.goto(ANA);
    await page.getByRole('link', { name: 'TAM', exact: true }).first().click();

    await expect(page).toHaveURL(/\/fornecedores\/02012862000160$/);
    await expect(page.getByRole('heading', { level: 1, name: 'TAM' })).toBeVisible();
    await expect(page.getByText('CNPJ 02.012.862/0001-60')).toBeVisible();
    await expect(page.getByRole('table', { name: /Deputados que pagaram TAM/ })).toContainText(
      'Ana Lúcia Souza',
    );
  });

  test('fornecedor inexistente responde 404', async ({ page }) => {
    const resposta = await page.goto('/fornecedores/11111111111111');
    expect(resposta?.status()).toBe(404);
    await expect(page.getByRole('heading', { name: 'Fornecedor não encontrado' })).toBeVisible();
  });

  test('comparação: adiciona e remove parlamentares pela URL', async ({ page }) => {
    await page.goto(ANA);
    await page.getByRole('link', { name: 'Comparar com outros parlamentares' }).click();
    await expect(page).toHaveURL(/\/comparar\?ids=cmana/);
    await expect(page.getByText('Selecionados (1 de 4)')).toBeVisible();

    await page.getByLabel('Nome do parlamentar').fill('bruno');
    await page.getByRole('button', { name: 'Buscar' }).click();
    await page.getByRole('link', { name: 'Adicionar Bruno Carvalho' }).click();

    await expect(page).toHaveURL(new RegExp(`ids=cmana0000000000000000000a1(%2C|,)${BRUNO}`));
    await expect(page.getByRole('heading', { name: 'Comparação em 2025' })).toBeVisible();
    const resumo = page.getByRole('table', { name: 'Resumo da comparação em 2025' });
    await expect(resumo.getByRole('row')).toHaveCount(3);
    await expect(resumo).toContainText('R$ 7.000,00');
    await expect(page.getByRole('table', { name: 'Gasto mensal em 2025' })).toBeAttached();

    await page.getByRole('link', { name: 'Remover Bruno Carvalho da comparação' }).click();
    await expect(page.getByText('Selecionados (1 de 4)')).toBeVisible();
  });

  test('Senado: filtro na busca, página do senador, ranking e home separados', async ({ page }) => {
    await page.goto('/parlamentares');
    await page.getByLabel('Casa').selectOption('SENADO');
    await page.getByRole('button', { name: 'Buscar' }).click();
    await expect(page).toHaveURL(/casa=SENADO/);
    await expect(page.getByText('1 parlamentar encontrado')).toBeVisible();

    await page.getByRole('link', { name: /Davi Senador/ }).click();
    await expect(page.getByText(/Senador\(a\) · PSD · AP/)).toBeVisible();
    await expect(page.getByRole('link', { name: /Perfil no site do Senado/ })).toHaveAttribute(
      'href',
      'https://www25.senado.leg.br/web/senadores/senador/-/perfil/5000',
    );

    await page.goto('/ranking?casa=SENADO');
    const tabela = page.getByRole('table', { name: /Ranking de gastos de 2025 \(Senado\)/ });
    await expect(tabela).toContainText('Davi Senador');
    await expect(page.getByText('1 senadores com despesas em 2025')).toBeVisible();

    await page.goto('/');
    await page
      .getByRole('navigation', { name: 'Casa legislativa' })
      .getByRole('link', { name: 'Senado' })
      .click();
    await expect(page).toHaveURL(/casa=SENADO/);
    await expect(
      page.getByRole('heading', { name: 'Cota parlamentar (CEAPS) em 2025' }),
    ).toBeVisible();
  });

  test('emendas: totais, áreas e lista na página do parlamentar', async ({ page }) => {
    await page.goto(ANA);
    const secao = page.locator('#emendas');
    await expect(
      secao.getByRole('heading', { name: 'Emendas parlamentares em 2025' }),
    ).toBeVisible();
    await expect(secao.getByText(/R\$\s4\.000,00/)).toBeVisible();
    await expect(secao.getByText('Educação').first()).toBeVisible();
    const tabela = secao.getByRole('table', { name: /Emendas de 2025/ });
    await expect(tabela.getByRole('row')).toHaveCount(3);
    await expect(tabela).toContainText('CAMPINAS - SP');
  });

  test('pontos de atenção: despesa atípica, concentração e critérios', async ({ page }) => {
    await page.goto(ANA);
    const secao = page.locator('#pontos-de-atencao');
    await expect(secao.getByRole('heading', { name: 'Pontos de atenção' })).toBeVisible();
    await expect(secao.getByText('Não indicam irregularidade')).toBeVisible();
    await expect(secao.getByText(/4× a mediana da categoria/)).toBeVisible();
    await expect(secao.getByText('100%')).toBeVisible();
    await secao.getByText('Como é calculado').click();
    await expect(secao.getByText(/maior que 99% das despesas/)).toBeVisible();
  });

  test('pontos de atenção ficam logo abaixo dos totais do parlamentar', async ({ page }) => {
    await page.goto(ANA);
    const titulos = await page.getByRole('heading', { level: 3 }).allTextContents();
    expect(titulos.indexOf('Pontos de atenção')).toBe(0);
    expect(titulos.indexOf('Evolução mensal')).toBe(1);
  });

  test('home destaca os principais pontos de atenção acima dos gráficos', async ({ page }) => {
    await page.goto('/');
    const secao = page.getByRole('region', { name: 'Principais pontos de atenção' });
    await expect(secao.getByText('Não indicam irregularidade')).toBeVisible();
    await expect(secao.getByText('3 despesas atípicas', { exact: false })).toBeVisible();
    await expect(secao.getByText(/4× a mediana/)).toBeVisible();
    await expect(secao.getByText('100%')).toBeVisible();

    const titulos = await page.getByRole('heading', { level: 3 }).allTextContents();
    expect(titulos.indexOf('Principais pontos de atenção')).toBeLessThan(
      titulos.indexOf('Gastos por categoria'),
    );

    await secao.getByRole('link', { name: 'Ana Lúcia Souza' }).first().click();
    await expect(page).toHaveURL(
      /\/parlamentares\/cmana0000000000000000000a1\?ano=2025#pontos-de-atencao/,
    );

    await page.goto('/?casa=SENADO');
    await expect(page.getByText('Nenhum valor fora do padrão neste ano.')).toBeVisible();
  });

  test('emendas: estado vazio para quem não tem emendas vinculadas', async ({ page }) => {
    await page.goto('/parlamentares/cmdavi000000000000000000d4');
    await expect(page.getByText(/Nenhuma emenda individual vinculada/)).toBeVisible();
  });

  for (const [nome, url] of [
    ['home', '/'],
    ['home do Senado', '/?casa=SENADO'],
    ['senador', '/parlamentares/cmdavi000000000000000000d4'],
    ['ranking', '/ranking'],
    ['fornecedor', '/fornecedores/02012862000160'],
    ['comparação', `/comparar?ids=cmana0000000000000000000a1,${BRUNO}`],
  ] as const) {
    test(`${nome} não tem violações de acessibilidade (claro e escuro)`, async ({ page }) => {
      await page.goto(url);
      await semViolacoesDeAcessibilidade(page);
      await page.emulateMedia({ colorScheme: 'dark' });
      await page.reload();
      await semViolacoesDeAcessibilidade(page);
    });
  }
});
