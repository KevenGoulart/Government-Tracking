/**
 * Gera as imagens do README (docs/img) a partir do app rodando com dados reais.
 *
 *   pnpm --filter @raio-x/web capturas -- <id de um parlamentar>
 *
 * Requer o front em http://localhost:3000 (ou CAPTURAS_URL) apontando para a API com dados.
 * Executado diretamente pelo Node (type stripping).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium, type Page } from '@playwright/test';
import gifenc from 'gifenc';
import { PNG } from 'pngjs';

// gifenc é CommonJS: as funções vêm do export default
const { applyPalette, GIFEncoder, quantize } = gifenc;
const BASE = process.env.CAPTURAS_URL ?? 'http://localhost:3000';
const SAIDA = resolve(import.meta.dirname, '../../../docs/img');
const [idParlamentar] = process.argv.slice(2).filter((arg) => arg !== '--');
if (!idParlamentar) throw new Error('Informe o id de um parlamentar com dados');

const LARGURA = 1280;
const ALTURA = 800;

mkdirSync(SAIDA, { recursive: true });
const browser = await chromium.launch();

async function novaPagina(opcoes: { escuro?: boolean; celular?: boolean } = {}): Promise<Page> {
  const contexto = await browser.newContext({
    viewport: opcoes.celular ? { width: 390, height: 844 } : { width: LARGURA, height: ALTURA },
    deviceScaleFactor: opcoes.celular ? 2 : 1,
    colorScheme: opcoes.escuro ? 'dark' : 'light',
    locale: 'pt-BR',
  });
  return contexto.newPage();
}

async function capturar(page: Page, caminho: string, arquivo: string, ancora?: string) {
  await page.goto(`${BASE}${caminho}`, { waitUntil: 'networkidle' });
  if (ancora) await page.locator(ancora).scrollIntoViewIfNeeded();
  await page.screenshot({ path: resolve(SAIDA, arquivo), fullPage: !ancora });
  process.stdout.write(`✓ ${arquivo}\n`);
}

const parlamentar = `/parlamentares/${idParlamentar}`;
const claro = await novaPagina();
await capturar(claro, '/', 'home.png');
await capturar(claro, parlamentar, 'parlamentar.png');
await capturar(claro, '/ranking', 'ranking.png');
const escuro = await novaPagina({ escuro: true });
await capturar(
  escuro,
  `${parlamentar}#pontos-de-atencao`,
  'pontos-de-atencao.png',
  '#pontos-de-atencao',
);
const celular = await novaPagina({ celular: true });
await capturar(celular, parlamentar, 'celular.png', 'h1');

// GIF: um percurso curto pelo app, montado a partir de capturas da janela
const quadros: { png: Buffer; atraso: number }[] = [];
const quadro = async (page: Page, atraso = 1_200) => {
  quadros.push({ png: await page.screenshot(), atraso });
};
const tour = await novaPagina();
await tour.goto(`${BASE}/`, { waitUntil: 'networkidle' });
await quadro(tour, 1_800);
await tour.goto(`${BASE}/parlamentares`, { waitUntil: 'networkidle' });
await quadro(tour, 800);
await tour.getByLabel('Nome').pressSequentially('silva', { delay: 60 });
await quadro(tour, 600);
await tour.goto(`${BASE}${parlamentar}`, { waitUntil: 'networkidle' });
await quadro(tour, 1_800);
for (const ancora of ['#pontos-de-atencao', '#despesas', '#emendas']) {
  await tour.locator(ancora).scrollIntoViewIfNeeded();
  await tour.evaluate((seletor) => {
    document.querySelector(seletor)?.scrollIntoView({ block: 'start' });
  }, ancora);
  await quadro(tour, 1_800);
}
await tour.goto(`${BASE}/ranking`, { waitUntil: 'networkidle' });
await quadro(tour, 1_800);
await browser.close();

const gif = GIFEncoder();
for (const { png, atraso } of quadros) {
  const { data, width, height } = PNG.sync.read(png);
  const rgba = new Uint8Array(data);
  const paleta = quantize(rgba, 256);
  gif.writeFrame(applyPalette(rgba, paleta), width, height, { palette: paleta, delay: atraso });
}
gif.finish();
writeFileSync(resolve(SAIDA, 'tour.gif'), gif.bytes());
process.stdout.write(`✓ tour.gif (${quadros.length} quadros)\n`);
