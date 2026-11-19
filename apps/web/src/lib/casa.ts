import type { Casa } from '@raio-x/shared';

interface InfoCasa {
  nome: string;
  /** Cargo no singular, neutro quanto a gênero. */
  cargo: string;
  /** Plural usado em frases ("deputados com despesas"). */
  plural: string;
  /** Sigla oficial da cota. */
  cota: string;
  perfil: (idExterno: string) => string;
  fonteDespesas: { rotulo: string; url: string };
}

export const CASAS: Record<Casa, InfoCasa> = {
  CAMARA: {
    nome: 'Câmara',
    cargo: 'Deputado(a) federal',
    plural: 'deputados',
    cota: 'CEAP',
    perfil: (id) => `https://www.camara.leg.br/deputados/${id}`,
    fonteDespesas: {
      rotulo: 'Cota Parlamentar da Câmara',
      url: 'https://www2.camara.leg.br/transparencia/cota-para-exercicio-da-atividade-parlamentar/dados-abertos-cota-parlamentar',
    },
  },
  SENADO: {
    nome: 'Senado',
    cargo: 'Senador(a)',
    plural: 'senadores',
    cota: 'CEAPS',
    perfil: (id) => `https://www25.senado.leg.br/web/senadores/senador/-/perfil/${id}`,
    fonteDespesas: {
      rotulo: 'CEAPS do Senado',
      url: 'https://www12.senado.leg.br/transparencia/dados-abertos-transparencia',
    },
  },
};

/** Lê `?casa=` da URL; qualquer valor diferente de SENADO volta para a Câmara. */
export function casaDaUrl(valor: string | undefined): Casa {
  return valor === 'SENADO' ? 'SENADO' : 'CAMARA';
}
