/**
 * Cores das séries na comparação, em ordem fixa (nunca reordenada pelo valor):
 * a paleta categórica validada para daltonismo nos temas claro e escuro.
 */
export const CORES_SERIES = [
  'var(--viz-series-1)',
  'var(--viz-series-2)',
  'var(--viz-series-3)',
  'var(--viz-series-4)',
] as const;

export interface Serie {
  id: string;
  nome: string;
  cor: string;
}
