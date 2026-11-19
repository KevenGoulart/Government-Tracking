import { Module } from '@nestjs/common';
import { RedisModule } from './common/redis.module';
import { ConfigModule } from './config/config.module';
import { HealthModule } from './health/health.module';
import { MetaController } from './meta/meta.controller';
import { ParlamentaresModule } from './parlamentares/parlamentares.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [ConfigModule, PrismaModule, RedisModule, HealthModule, ParlamentaresModule],
  controllers: [MetaController],
})
export class AppModule {}
