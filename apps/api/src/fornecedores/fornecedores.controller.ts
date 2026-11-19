import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiNotFoundResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import {
  type FornecedorDetalhe,
  fornecedorDetalheSchema,
  type FornecedorQuery,
  fornecedorQuerySchema,
} from '@raio-x/shared';
import { ApiZodOk, ApiZodQuery } from '../common/swagger-zod';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { FornecedoresService } from './fornecedores.service';

@ApiTags('fornecedores')
@Controller('fornecedores')
export class FornecedoresController {
  constructor(private readonly service: FornecedoresService) {}

  @Get(':documento')
  @ApiOperation({ summary: 'Fornecedor e parlamentares que o pagaram com a cota' })
  @ApiParam({
    name: 'documento',
    description:
      'CNPJ ou CPF (com ou sem pontuação). Fornecedores sem documento válido na fonte são acessados pelo id interno.',
    example: '02012862000160',
  })
  @ApiZodQuery(fornecedorQuerySchema)
  @ApiZodOk(fornecedorDetalheSchema)
  @ApiNotFoundResponse({ description: 'Fornecedor não encontrado' })
  detalhe(
    @Param('documento') documento: string,
    @Query(new ZodValidationPipe(fornecedorQuerySchema)) query: FornecedorQuery,
  ): Promise<FornecedorDetalhe> {
    return this.service.detalhe(documento, query);
  }
}
