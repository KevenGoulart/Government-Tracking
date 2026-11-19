import { Module } from '@nestjs/common';
import { ConfigModule } from './config/config.module';
import { PrismaModule } from './prisma/prisma.module';
import { QueuesModule } from './queues/queues.module';
import { SyncProcessor } from './queues/sync.processor';
import { SyncScheduler } from './queues/sync.scheduler';
import { SyncModule } from './sync/sync.module';

/** Processo do worker: consome a fila e registra os agendamentos. */
@Module({
  imports: [ConfigModule, PrismaModule, QueuesModule, SyncModule],
  providers: [SyncProcessor, SyncScheduler],
})
export class WorkerModule {}

/** Contexto da CLI: apenas os serviços de sincronização, sem fila nem agendamentos. */
@Module({
  imports: [ConfigModule, PrismaModule, SyncModule],
})
export class CliModule {}
