import {
  Controller,
  Get,
  Injectable,
  NotFoundException,
  Param,
  type PipeTransform,
  Query,
} from '@nestjs/common';
import { ApiNotFoundResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  type Categoria,
  categoriaSchema,
  type Despesa,
  despesaSchema,
  type DespesasQuery,
  despesasQuerySchema,
  type FiltrosParlamentares,
  filtrosParlamentaresSchema,
  type GastoMensal,
  gastoMensalSchema,
  type GastosMensaisQuery,
  gastosMensaisQuerySchema,
  type Paginated,
  paginatedSchema,
  type ParlamentarDetalhe,
  type ParlamentarDetalheQuery,
  parlamentarDetalheQuerySchema,
  parlamentarDetalheSchema,
  type ParlamentaresQuery,
  parlamentaresQuerySchema,
  type ParlamentarResumo,
  parlamentarResumoSchema,
} from '@raio-x/shared';
import { z } from 'zod';
import { ApiZodOk, ApiZodQuery } from '../common/swagger-zod';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { ParlamentaresService } from './parlamentares.service';

/** IDs gerados pelo Prisma (cuid). Formato inválido responde 404 sem consultar o banco. */
@Injectable()
class IdPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (!/^[a-z0-9]{20,32}$/.test(value)) throw new NotFoundException('Parlamentar não encontrado');
    return value;
  }
}

@ApiTags('parlamentares')
@Controller()
export class ParlamentaresController {
  constructor(private readonly service: ParlamentaresService) {}

  @Get('parlamentares')
  @ApiOperation({ summary: 'Lista parlamentares com busca por nome e filtros' })
  @ApiZodQuery(parlamentaresQuerySchema)
  @ApiZodOk(paginatedSchema(parlamentarResumoSchema))
  listar(
    @Query(new ZodValidationPipe(parlamentaresQuerySchema)) query: ParlamentaresQuery,
  ): Promise<Paginated<ParlamentarResumo>> {
    return this.service.listar(query);
  }

  @Get('parlamentares/filtros')
  @ApiOperation({ summary: 'Partidos e UFs disponíveis para filtrar a listagem' })
  @ApiZodOk(filtrosParlamentaresSchema)
  filtros(): Promise<FiltrosParlamentares> {
    return this.service.filtros();
  }

  @Get('categorias')
  @ApiOperation({ summary: 'Categorias de despesa da cota parlamentar' })
  @ApiZodOk(z.array(categoriaSchema))
  categorias(): Promise<Categoria[]> {
    return this.service.categorias();
  }

  @Get('parlamentares/:id')
  @ApiOperation({ summary: 'Dados do parlamentar e resumo de gastos' })
  @ApiZodQuery(parlamentarDetalheQuerySchema)
  @ApiZodOk(parlamentarDetalheSchema)
  @ApiNotFoundResponse({ description: 'Parlamentar não encontrado' })
  detalhe(
    @Param('id', IdPipe) id: string,
    @Query(new ZodValidationPipe(parlamentarDetalheQuerySchema)) query: ParlamentarDetalheQuery,
  ): Promise<ParlamentarDetalhe> {
    return this.service.detalhe(id, query);
  }

  @Get('parlamentares/:id/despesas')
  @ApiOperation({ summary: 'Despesas do parlamentar, com filtros e paginação' })
  @ApiZodQuery(despesasQuerySchema)
  @ApiZodOk(paginatedSchema(despesaSchema))
  @ApiNotFoundResponse({ description: 'Parlamentar não encontrado' })
  despesas(
    @Param('id', IdPipe) id: string,
    @Query(new ZodValidationPipe(despesasQuerySchema)) query: DespesasQuery,
  ): Promise<Paginated<Despesa>> {
    return this.service.despesas(id, query);
  }

  @Get('parlamentares/:id/gastos-mensais')
  @ApiOperation({ summary: 'Série mensal do total gasto (valor líquido)' })
  @ApiZodQuery(gastosMensaisQuerySchema)
  @ApiZodOk(z.array(gastoMensalSchema))
  @ApiNotFoundResponse({ description: 'Parlamentar não encontrado' })
  gastosMensais(
    @Param('id', IdPipe) id: string,
    @Query(new ZodValidationPipe(gastosMensaisQuerySchema)) query: GastosMensaisQuery,
  ): Promise<GastoMensal[]> {
    return this.service.gastosMensais(id, query);
  }
}
