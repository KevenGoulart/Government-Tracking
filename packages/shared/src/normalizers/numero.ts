/**
 * Converte um valor monetário no formato brasileiro ("8.000,00", "-1966,37", "4000",
 * ",03") para decimal com ponto e 2 casas ("8000.00"). Lança erro para valores inválidos.
 */
export function decimalBrasileiro(valor: string): string {
  const limpo = valor.trim();
  // A parte inteira pode faltar: o CSV do Senado traz valores como ",03" (R$ 0,03).
  const valido = /^-?(\d{1,3}(\.\d{3})+|\d+)(,\d+)?$/.test(limpo) || /^-?,\d+$/.test(limpo);
  if (!valido) {
    throw new Error(`Valor monetário inválido: "${valor}"`);
  }
  const numero = Number(limpo.replace(/\./g, '').replace(',', '.'));
  return numero.toFixed(2);
}

/** "18/01/2025" → "2025-01-18"; datas vazias ou inválidas viram null. */
export function dataBrasileira(valor: string): string | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(valor.trim());
  if (!match) return null;
  const [, dia, mes, ano] = match;
  const iso = `${ano}-${mes}-${dia}`;
  const data = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(data.getTime()) || data.toISOString().slice(0, 10) !== iso ? null : iso;
}
