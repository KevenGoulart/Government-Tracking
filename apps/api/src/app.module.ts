import { Module } from '@nestjs/common';
import { RedisModule } from './common/redis.module';
import { ConfigModule } from './config/config.module';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [ConfigModule, PrismaModule, RedisModule, HealthModule],
})
export class AppModule {}
