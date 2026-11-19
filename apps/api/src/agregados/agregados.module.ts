import { Module } from '@nestjs/common';
import { AgregadosController } from './agregados.controller';
import { AgregadosService } from './agregados.service';

@Module({
  controllers: [AgregadosController],
  providers: [AgregadosService],
})
export class AgregadosModule {}
