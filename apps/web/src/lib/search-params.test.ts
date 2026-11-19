import { despesasQuerySchema, parlamentaresQuerySchema } from '@raio-x/shared';
import { achatar, hrefCom, lerParams, primeiro } from './search-params';

describe('search params', () => {
  it('usa o primeiro valor de parâmetros repetidos', () => {
    expect(primeiro(['a', 'b'])).toBe('a');
    expect(primeiro('x')).toBe('x');
    expect(achatar({ uf: ['SP', 'RJ'], nome: 'ana' })).toEqual({ uf: 'SP', nome: 'ana' });
  });

  it('descarta parâmetros inválidos sem perder os válidos', () => {
    const q = lerParams(parlamentaresQuerySchema, { uf: 'XX', nome: 'ana', page: '0' });
    expect(q).toMatchObject({ nome: 'ana', page: 1 });
    expect(q.uf).toBeUndefined();
  });

  it('aplica padrões quando não há parâmetros', () => {
    expect(lerParams(despesasQuerySchema, {})).toMatchObject({
      page: 1,
      ordenarPor: 'data',
      ordem: 'desc',
    });
  });

  it('monta links preservando filtros e removendo vazios', () => {
    expect(hrefCom('/parlamentares', { nome: 'ana', uf: 'SP', page: 2 }, { page: 3 })).toBe(
      '/parlamentares?nome=ana&uf=SP&page=3',
    );
    expect(hrefCom('/p', { uf: 'SP' }, { uf: undefined })).toBe('/p');
  });
});
