export {
  formatarDocumento,
  formatarMoeda,
  formatarMoedaCompacta,
  nomeMesCurto,
} from '@raio-x/shared';

const MESES_LONGOS = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];

export function nomeMes(mes: number): string {
  return MESES_LONGOS[mes - 1] ?? String(mes);
}

/** "2025-01-28" → "28/01/2025" (sem passar por Date, evitando deslocamento de fuso). */
export function formatarData(data: string | null): string {
  if (!data) return '—';
  const [ano, mes, dia] = data.split('-');
  return `${dia}/${mes}/${ano}`;
}

const dataHora = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'America/Sao_Paulo',
});

export function formatarDataHora(iso: string): string {
  return dataHora.format(new Date(iso));
}

/** Siglas que aparecem nos rótulos oficiais das categorias da cota. */
const SIGLAS = new Set(['SIGEPA', 'RPA', 'DF']);

/** Rótulos oficiais vêm em maiúsculas; exibimos em caixa de frase preservando siglas. */
export function caixaDeFrase(texto: string): string {
  const minusculo = texto.toLocaleLowerCase('pt-BR');
  const frase = minusculo.charAt(0).toLocaleUpperCase('pt-BR') + minusculo.slice(1);
  return frase.replace(/\p{L}+/gu, (palavra) => {
    const maiuscula = palavra.toLocaleUpperCase('pt-BR');
    return SIGLAS.has(maiuscula) ? maiuscula : palavra;
  });
}
