import type { z } from 'zod';

export type SearchParams = Record<string, string | string[] | undefined>;

/** Primeiro valor de um parâmetro de URL (`?a=1&a=2` → "1"). */
export function primeiro(valor: string | string[] | undefined): string | undefined {
  return Array.isArray(valor) ? valor[0] : valor;
}

/** Achata os search params para validar com os schemas Zod compartilhados. */
export function achatar(params: SearchParams): Record<string, string | undefined> {
  return Object.fromEntries(Object.entries(params).map(([k, v]) => [k, primeiro(v)]));
}

/**
 * Valida os parâmetros da URL com um schema; parâmetros inválidos (link editado à mão)
 * são descartados em vez de quebrar a página.
 */
export function lerParams<T extends z.ZodObject>(schema: T, params: SearchParams): z.infer<T> {
  const dados = achatar(params);
  const resultado = schema.safeParse(dados);
  if (resultado.success) return resultado.data;

  const invalidos = new Set(resultado.error.issues.map((issue) => String(issue.path[0])));
  const limpos = Object.fromEntries(Object.entries(dados).filter(([k]) => !invalidos.has(k)));
  return schema.parse(limpos);
}

/** Monta um href preservando os parâmetros atuais e sobrescrevendo alguns. */
export function hrefCom(
  base: string,
  atuais: Record<string, string | number | undefined>,
  mudancas: Record<string, string | number | undefined>,
): string {
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...atuais, ...mudancas })) {
    if (v !== undefined && v !== '') search.set(k, String(v));
  }
  const texto = search.toString();
  return texto ? `${base}?${texto}` : base;
}
