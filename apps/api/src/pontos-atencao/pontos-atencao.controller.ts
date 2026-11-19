import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiNotFoundResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  type PontosAtencao,
  type PontosAtencaoQuery,
  pontosAtencaoQuerySchema,
  pontosAtencaoSchema,
} from '@raio-x/shared';
import { IdParlamentarPipe } from '../common/id-parlamentar.pipe';
import { ApiZodOk, ApiZodQuery } from '../common/swagger-zod';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { PontosAtencaoService } from './pontos-atencao.service';

@ApiTags('pontos-de-atencao')
@Controller('parlamentares/:id/pontos-de-atencao')
export class PontosAtencaoController {
  constructor(private readonly service: PontosAtencaoService) {}

  @Get()
  @ApiOperation({
    summary: 'Valores fora do padrão na cota do parlamentar',
    description:
      'Despesas atípicas para a categoria (acima do percentil 99 e de Q3 + 3×IQR) e concentração ' +
      'de metade ou mais do total do ano (sem passagens) em um único fornecedor. ' +
      'São indicadores estatísticos, não indícios de irregularidade.',
  })
  @ApiZodQuery(pontosAtencaoQuerySchema)
  @ApiZodOk(pontosAtencaoSchema)
  @ApiNotFoundResponse({ description: 'Parlamentar não encontrado' })
  doParlamentar(
    @Param('id', IdParlamentarPipe) id: string,
    @Query(new ZodValidationPipe(pontosAtencaoQuerySchema)) query: PontosAtencaoQuery,
  ): Promise<PontosAtencao> {
    return this.service.doParlamentar(id, query);
  }
}
