import { BadRequestException } from '@nestjs/common';
import { paginationQuerySchema } from '@raio-x/shared';
import { ZodValidationPipe } from './zod-validation.pipe';

describe('ZodValidationPipe', () => {
  const pipe = new ZodValidationPipe(paginationQuerySchema);

  it('retorna o valor transformado pelo schema', () => {
    expect(pipe.transform({ page: '2' })).toEqual({ page: 2, pageSize: 20 });
  });

  it('lança BadRequest com a lista de erros por campo', () => {
    expect(() => pipe.transform({ page: '0' })).toThrow(BadRequestException);
    try {
      pipe.transform({ page: '0' });
    } catch (error) {
      const body = (error as BadRequestException).getResponse() as { errors: { path: string }[] };
      expect(body.errors[0]?.path).toBe('page');
    }
  });
});
