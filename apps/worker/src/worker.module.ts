import { Module } from '@nestjs/common';
import { ConfigModule } from './config/config.module';
import { QueuesModule } from './queues/queues.module';

@Module({
  imports: [ConfigModule, QueuesModule],
})
export class WorkerModule {}
