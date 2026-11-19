import { Controller, Get, Query } from '@nestjs/common';
import { ApiNotFoundResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  type Comparacao,
  type ComparacaoQuery,
  comparacaoQuerySchema,
  comparacaoSchema,
  type Estatisticas,
  type EstatisticasQuery,
  estatisticasQuerySchema,
  estatisticasSchema,
  type Ranking,
  type RankingQuery,
  rankingQuerySchema,
  rankingSchema,
} from '@raio-x/shared';
import { ApiZodOk, ApiZodQuery } from '../common/swagger-zod';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { AgregadosService } from './agregados.service';

@ApiTags('agregados')
@Controller()
export class AgregadosController {
  constructor(private readonly service: AgregadosService) {}

  @Get('rankings')
  @ApiOperation({
    summary: 'Total gasto por parlamentar no ano',
    description: 'Ordenado do maior para o menor total. Partido e UF são os atuais do parlamentar.',
  })
  @ApiZodQuery(rankingQuerySchema)
  @ApiZodOk(rankingSchema)
  ranking(@Query(new ZodValidationPipe(rankingQuerySchema)) query: RankingQuery): Promise<Ranking> {
    return this.service.ranking(query);
  }

  @Get('estatisticas')
  @ApiOperation({ summary: 'Totais gerais do ano, por categoria, por estado e maiores gastos' })
  @ApiZodQuery(estatisticasQuerySchema)
  @ApiZodOk(estatisticasSchema)
  estatisticas(
    @Query(new ZodValidationPipe(estatisticasQuerySchema)) query: EstatisticasQuery,
  ): Promise<Estatisticas> {
    return this.service.estatisticas(query);
  }

  @Get('comparacao')
  @ApiOperation({ summary: 'Compara de 2 a 4 parlamentares no mesmo ano' })
  @ApiZodQuery(comparacaoQuerySchema)
  @ApiZodOk(comparacaoSchema)
  @ApiNotFoundResponse({ description: 'Algum dos parlamentares não existe' })
  comparacao(
    @Query(new ZodValidationPipe(comparacaoQuerySchema)) query: ComparacaoQuery,
  ): Promise<Comparacao> {
    return this.service.comparacao(query);
  }
}
