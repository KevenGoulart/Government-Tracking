import { Module } from '@nestjs/common';
import { EmendasController } from './emendas.controller';
import { EmendasService } from './emendas.service';

@Module({
  controllers: [EmendasController],
  providers: [EmendasService],
})
export class EmendasModule {}
