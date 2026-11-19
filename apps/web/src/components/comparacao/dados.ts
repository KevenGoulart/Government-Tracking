import { type Comparacao, MAX_COMPARACAO } from '@raio-x/shared';
import { caixaDeFrase } from '@/lib/format';
import type { LinhaComparacao } from './graficos-comparacao';

/** Lê `?ids=a,b,c` da URL: sem vazios, sem repetidos e no máximo 4. */
export function idsDaUrl(valor: string | undefined): string[] {
  const ids = (valor ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
  return [...new Set(ids)].slice(0, MAX_COMPARACAO);
}

/** Série mensal com uma coluna por parlamentar; meses sem despesa entram como zero. */
export function montarMensal(comparacao: Comparacao, hoje = new Date()): LinhaComparacao[] {
  const { ano } = comparacao;
  if (ano === null) return [];
  const meses = comparacao.parlamentares.flatMap((p) => p.mensal.map((m) => m.mes));
  const ultimoMes = ano < hoje.getFullYear() ? 12 : Math.max(1, ...meses);

  return Array.from({ length: ultimoMes }, (_, i) => {
    const mes = i + 1;
    const linha: LinhaComparacao = { rotulo: String(mes) };
    for (const p of comparacao.parlamentares) {
      linha[p.parlamentar.id] = Number(p.mensal.find((m) => m.mes === mes)?.total ?? 0);
    }
    return linha;
  });
}

/** As categorias de maior total somado entre os parlamentares, com uma coluna por parlamentar. */
export function montarCategorias(comparacao: Comparacao, limite = 8): LinhaComparacao[] {
  const somas = new Map<string, { nome: string; total: number }>();
  for (const p of comparacao.parlamentares) {
    for (const c of p.categorias) {
      const atual = somas.get(c.slug) ?? { nome: c.nome, total: 0 };
      atual.total += Number(c.total);
      somas.set(c.slug, atual);
    }
  }
  return [...somas]
    .sort(([, a], [, b]) => b.total - a.total)
    .slice(0, limite)
    .map(([slug, { nome }]) => {
      const linha: LinhaComparacao = { rotulo: caixaDeFrase(nome) };
      for (const p of comparacao.parlamentares) {
        linha[p.parlamentar.id] = Number(p.categorias.find((c) => c.slug === slug)?.total ?? 0);
      }
      return linha;
    });
}
