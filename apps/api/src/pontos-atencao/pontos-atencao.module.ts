import { Module } from '@nestjs/common';
import { PontosAtencaoController } from './pontos-atencao.controller';
import { PontosAtencaoService } from './pontos-atencao.service';

@Module({
  controllers: [PontosAtencaoController],
  providers: [PontosAtencaoService],
})
export class PontosAtencaoModule {}
