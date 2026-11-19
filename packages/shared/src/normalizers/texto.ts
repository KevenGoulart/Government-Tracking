/** Remove acentos e diacríticos mantendo as letras base ("Ação" → "Acao"). */
export function removerAcentos(valor: string): string {
  return valor.normalize('NFD').replace(/\p{Diacritic}/gu, '');
}

/** Remove espaços nas pontas e colapsa espaços internos repetidos. */
export function colapsarEspacos(valor: string): string {
  return valor.replace(/\s+/g, ' ').trim();
}

/**
 * Forma canônica de um nome para comparação e chaves: sem acentos, maiúsculas,
 * sem pontuação solta e com espaços colapsados ("Posto  Nativus Ltda." → "POSTO NATIVUS LTDA").
 */
export function normalizarNome(valor: string): string {
  return colapsarEspacos(
    removerAcentos(valor)
      .toUpperCase()
      .replace(/[^\p{L}\p{N}&/ -]+/gu, ' '),
  );
}

/** Forma usada na busca textual (pg_trgm): minúsculas e sem acentos. */
export function normalizarParaBusca(valor: string): string {
  return colapsarEspacos(removerAcentos(valor).toLowerCase());
}
