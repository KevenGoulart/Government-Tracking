import { Global, Inject, Module, type OnModuleDestroy } from '@nestjs/common';
import { Redis } from 'ioredis';
import { APP_CONFIG, type AppConfig } from '../config/config.module';

export const REDIS = Symbol('REDIS');

@Global()
@Module({
  providers: [
    {
      provide: REDIS,
      useFactory: (config: AppConfig) =>
        new Redis(config.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 2 }),
      inject: [APP_CONFIG],
    },
  ],
  exports: [REDIS],
})
export class RedisModule implements OnModuleDestroy {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  async onModuleDestroy(): Promise<void> {
    if (this.redis.status !== 'end' && this.redis.status !== 'wait') {
      await this.redis.quit().catch(() => undefined);
    }
  }
}
