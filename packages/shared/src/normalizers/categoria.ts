import { colapsarEspacos, removerAcentos } from './texto';

/**
 * Limpa o rótulo oficial da categoria sem reescrevê-lo:
 * "HOSPEDAGEM ,EXCETO DO PARLAMENTAR NO DISTRITO FEDERAL." → "HOSPEDAGEM, EXCETO DO PARLAMENTAR NO DISTRITO FEDERAL".
 */
export function limparNomeCategoria(valor: string): string {
  return colapsarEspacos(valor)
    .replace(/\s+,/g, ',')
    .replace(/,(?=\S)/g, ', ')
    .replace(/[.\s]+$/, '');
}

/** Identificador estável da categoria, derivado do rótulo limpo. */
export function slugCategoria(valor: string): string {
  return removerAcentos(limparNomeCategoria(valor))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
