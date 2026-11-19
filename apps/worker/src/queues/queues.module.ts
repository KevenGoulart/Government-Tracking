import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../config/config.module';

/** Nomes das filas usadas pela ingestão. */
export const QUEUES = {
  SYNC: 'sync',
} as const;

@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => ({
        // `maxRetriesPerRequest: null` é exigido pelos workers do BullMQ (comandos bloqueantes).
        connection: { url: config.REDIS_URL, maxRetriesPerRequest: null },
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 5_000 },
          removeOnComplete: { age: 7 * 24 * 3600, count: 1_000 },
          removeOnFail: { age: 30 * 24 * 3600 },
        },
      }),
    }),
    BullModule.registerQueue({ name: QUEUES.SYNC }),
  ],
  exports: [BullModule],
})
export class QueuesModule {}
