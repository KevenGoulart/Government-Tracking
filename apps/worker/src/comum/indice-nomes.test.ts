import { chaveNome, IndiceNomes } from './indice-nomes';

// Casos reais observados nas fontes do Senado e do Portal da Transparência
const indice = new IndiceNomes([
  { id: 'alan', nome: 'Alan Rick', nomeCivil: 'Alan Rick Miranda' },
  { id: 'weverton', nome: 'Weverton', nomeCivil: 'Weverton Rocha Marques de Sousa' },
  { id: 'fc1', nome: 'Fernando Carvalho', nomeCivil: 'Fernando Luiz Prado Carvalho Junior' },
  { id: 'fc2', nome: 'Fernando Carvalho', nomeCivil: 'Antonio Fernando Pereira de Carvalho' },
  { id: 'sostenes', nome: 'Sóstenes Cavalcante', nomeCivil: null },
  { id: 'joao1', nome: 'João Silva', nomeCivil: 'João Carlos da Silva' },
  { id: 'joao2', nome: 'João Souza', nomeCivil: 'João Carlos de Souza' },
]);

describe('chaveNome', () => {
  it('remove acentos, pontuação e espaços extras', () => {
    expect(chaveNome('  Sóstenes   Cavalcante. ')).toBe('SOSTENES CAVALCANTE');
  });
});

describe('IndiceNomes', () => {
  it('encontra pelo nome parlamentar ignorando caixa e acentos', () => {
    expect(indice.resolver('ALAN RICK')).toEqual({ status: 'encontrado', id: 'alan' });
    expect(indice.resolver('SOSTENES CAVALCANTE')).toEqual({
      status: 'encontrado',
      id: 'sostenes',
    });
  });

  it('usa o nome civil quando a fonte acrescenta um sobrenome', () => {
    expect(indice.resolver('WEVERTON ROCHA')).toEqual({ status: 'encontrado', id: 'weverton' });
  });

  it('não escolhe entre homônimos', () => {
    expect(indice.resolver('FERNANDO CARVALHO')).toEqual({
      status: 'ambiguo',
      ids: ['fc1', 'fc2'],
    });
  });

  it('não escolhe quando o nome civil casa com mais de uma pessoa', () => {
    expect(indice.resolver('JOAO CARLOS')).toEqual({ status: 'ambiguo', ids: ['joao1', 'joao2'] });
  });

  it('exige que a primeira palavra coincida com o nome parlamentar', () => {
    // "ANTONIO CARVALHO" aparece em ordem no nome civil de fc2, mas o nome parlamentar dele
    // começa com "Fernando": não é a mesma forma de chamar a pessoa.
    expect(indice.resolver('ANTONIO CARVALHO')).toEqual({ status: 'nao-encontrado' });
  });

  it('retorna não encontrado para nomes desconhecidos ou vazios', () => {
    expect(indice.resolver('BANCADA DO RIO DE JANEIRO')).toEqual({ status: 'nao-encontrado' });
    expect(indice.resolver('  ')).toEqual({ status: 'nao-encontrado' });
  });
});
