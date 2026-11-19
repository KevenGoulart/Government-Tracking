export type TipoDocumento = 'CNPJ' | 'CPF';

export interface DocumentoNormalizado {
  /** Somente dígitos, ou `null` quando ausente ou inválido. */
  documento: string | null;
  tipo: TipoDocumento | null;
}

export function somenteDigitos(valor: string): string {
  return valor.replace(/\D/g, '');
}

function todosDigitosIguais(digitos: string): boolean {
  return /^(\d)\1*$/.test(digitos);
}

function digitoVerificador(digitos: string, pesos: number[]): number {
  const soma = pesos.reduce((acc, peso, i) => acc + Number(digitos[i]) * peso, 0);
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

export function cpfValido(valor: string): boolean {
  const d = somenteDigitos(valor);
  if (d.length !== 11 || todosDigitosIguais(d)) return false;
  const dv1 = digitoVerificador(d, [10, 9, 8, 7, 6, 5, 4, 3, 2]);
  const dv2 = digitoVerificador(d, [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]);
  return dv1 === Number(d[9]) && dv2 === Number(d[10]);
}

export function cnpjValido(valor: string): boolean {
  const d = somenteDigitos(valor);
  if (d.length !== 14 || todosDigitosIguais(d)) return false;
  const dv1 = digitoVerificador(d, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const dv2 = digitoVerificador(d, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return dv1 === Number(d[12]) && dv2 === Number(d[13]);
}

/**
 * Normaliza um CNPJ/CPF vindo da fonte. Documentos com dígitos verificadores inválidos
 * (a Câmara usa valores fictícios como "00000000000006" para ramais telefônicos) viram `null`.
 */
export function normalizarDocumento(valor: string | null | undefined): DocumentoNormalizado {
  const digitos = somenteDigitos(valor ?? '');
  if (cnpjValido(digitos)) return { documento: digitos, tipo: 'CNPJ' };
  if (cpfValido(digitos)) return { documento: digitos, tipo: 'CPF' };
  return { documento: null, tipo: null };
}

/** Formata para exibição: 00.000.000/0000-00 ou 000.000.000-00. */
export function formatarDocumento(documento: string): string {
  const d = somenteDigitos(documento);
  if (d.length === 14) return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  if (d.length === 11) return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
  return documento;
}
