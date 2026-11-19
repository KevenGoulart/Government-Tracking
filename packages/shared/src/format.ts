const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const moedaCompacta = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  notation: 'compact',
  maximumFractionDigits: 1,
});

/** Formata um valor monetário (a API envia decimais como string para não perder precisão). */
export function formatarMoeda(valor: string | number): string {
  return moeda.format(Number(valor));
}

export function formatarMoedaCompacta(valor: string | number): string {
  return moedaCompacta.format(Number(valor));
}

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

export function nomeMesCurto(mes: number): string {
  return MESES[mes - 1] ?? String(mes);
}
