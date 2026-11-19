import { Module } from '@nestjs/common';
import { AgregadosModule } from './agregados/agregados.module';
import { CacheModule } from './cache/cache.module';
import { RedisModule } from './common/redis.module';
import { ConfigModule } from './config/config.module';
import { FornecedoresModule } from './fornecedores/fornecedores.module';
import { HealthModule } from './health/health.module';
import { MetaController } from './meta/meta.controller';
import { ParlamentaresModule } from './parlamentares/parlamentares.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    RedisModule,
    CacheModule,
    HealthModule,
    ParlamentaresModule,
    AgregadosModule,
    FornecedoresModule,
  ],
  controllers: [MetaController],
})
export class AppModule {}
