import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiNotFoundResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  type EmendasParlamentar,
  emendasParlamentarSchema,
  type EmendasQuery,
  emendasQuerySchema,
} from '@raio-x/shared';
import { IdParlamentarPipe } from '../common/id-parlamentar.pipe';
import { ApiZodOk, ApiZodQuery } from '../common/swagger-zod';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { EmendasService } from './emendas.service';

@ApiTags('emendas')
@Controller('parlamentares/:id/emendas')
export class EmendasController {
  constructor(private readonly service: EmendasService) {}

  @Get()
  @ApiOperation({
    summary: 'Emendas parlamentares de autoria do parlamentar',
    description:
      'Fonte: Portal da Transparência. O vínculo com o autor é feito pelo nome; emendas de bancada não entram.',
  })
  @ApiZodQuery(emendasQuerySchema)
  @ApiZodOk(emendasParlamentarSchema)
  @ApiNotFoundResponse({ description: 'Parlamentar não encontrado' })
  listar(
    @Param('id', IdParlamentarPipe) id: string,
    @Query(new ZodValidationPipe(emendasQuerySchema)) query: EmendasQuery,
  ): Promise<EmendasParlamentar> {
    return this.service.doParlamentar(id, query);
  }
}
