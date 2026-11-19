import { removerAcentos } from '@raio-x/shared';

export interface PessoaIndexada {
  id: string;
  /** Nome parlamentar (ex.: "Alan Rick"). */
  nome: string;
  /** Nome civil completo (ex.: "Alan Rick Miranda"), quando conhecido. */
  nomeCivil: string | null;
}

export type ResultadoNome =
  | { status: 'encontrado'; id: string }
  | { status: 'ambiguo'; ids: string[] }
  | { status: 'nao-encontrado' };

/** "Sóstenes  Cavalcante" → "SOSTENES CAVALCANTE": sem acentos, pontuação ou espaços repetidos. */
export function chaveNome(nome: string): string {
  return removerAcentos(nome)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim();
}

function ehSubsequencia(procurados: string[], tokens: string[]): boolean {
  let i = 0;
  for (const token of tokens) if (token === procurados[i]) i++;
  return i === procurados.length;
}

/**
 * Resolve o nome de uma pessoa como aparece numa fonte (CSV do Senado, autor de emenda)
 * para o parlamentar correspondente. As fontes não trazem identificador, só o nome.
 *
 * Regras, nesta ordem:
 * 1. Nome parlamentar idêntico (ignorando acentos e caixa) e único → encontrado.
 * 2. Senão, todas as palavras do nome da fonte aparecem, na ordem, no nome civil, e a
 *    primeira palavra coincide com a do nome parlamentar ("WEVERTON ROCHA" → "Weverton",
 *    nome civil "Weverton Rocha Marques de Sousa") → encontrado se houver um só candidato.
 *
 * Mais de um candidato nunca é resolvido "no chute": volta como ambíguo, e quem chama
 * deixa o registro sem vínculo e o contabiliza.
 */
export class IndiceNomes {
  private readonly porNome = new Map<string, string[]>();
  private readonly pessoas: { id: string; primeiro: string; civil: string[] }[];

  constructor(pessoas: PessoaIndexada[]) {
    for (const p of pessoas) {
      const chave = chaveNome(p.nome);
      this.porNome.set(chave, [...(this.porNome.get(chave) ?? []), p.id]);
    }
    this.pessoas = pessoas.map((p) => ({
      id: p.id,
      primeiro: chaveNome(p.nome).split(' ')[0] ?? '',
      civil: p.nomeCivil ? chaveNome(p.nomeCivil).split(' ') : [],
    }));
  }

  get tamanho(): number {
    return this.pessoas.length;
  }

  resolver(nomeFonte: string): ResultadoNome {
    const chave = chaveNome(nomeFonte);
    if (!chave) return { status: 'nao-encontrado' };

    const exatos = this.porNome.get(chave) ?? [];
    if (exatos.length === 1 && exatos[0]) return { status: 'encontrado', id: exatos[0] };
    if (exatos.length > 1) return { status: 'ambiguo', ids: exatos };

    const tokens = chave.split(' ');
    const candidatos = this.pessoas
      .filter((p) => p.primeiro === tokens[0] && ehSubsequencia(tokens, p.civil))
      .map((p) => p.id);
    if (candidatos.length === 1 && candidatos[0])
      return { status: 'encontrado', id: candidatos[0] };
    if (candidatos.length > 1) return { status: 'ambiguo', ids: candidatos };
    return { status: 'nao-encontrado' };
  }
}
