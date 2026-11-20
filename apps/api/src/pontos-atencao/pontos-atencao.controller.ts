import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiNotFoundResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  type DestaquesPontosAtencao,
  type DestaquesPontosAtencaoQuery,
  destaquesPontosAtencaoQuerySchema,
  destaquesPontosAtencaoSchema,
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
@Controller()
export class PontosAtencaoController {
  constructor(private readonly service: PontosAtencaoService) {}

  @Get('pontos-de-atencao')
  @ApiOperation({
    summary: 'Pontos de atenção mais evidentes da casa no ano',
    description:
      'As despesas mais distantes da mediana da categoria e as maiores concentrações em um ' +
      'fornecedor, com as mesmas regras da rota do parlamentar. ' +
      'São indicadores estatísticos, não indícios de irregularidade.',
  })
  @ApiZodQuery(destaquesPontosAtencaoQuerySchema)
  @ApiZodOk(destaquesPontosAtencaoSchema)
  destaques(
    @Query(new ZodValidationPipe(destaquesPontosAtencaoQuerySchema))
    query: DestaquesPontosAtencaoQuery,
  ): Promise<DestaquesPontosAtencao> {
    return this.service.destaques(query);
  }

  @Get('parlamentares/:id/pontos-de-atencao')
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
