import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { WorkerModule } from './worker.module';

async function bootstrap(): Promise<void> {
  // Contexto standalone: sem servidor HTTP, apenas filas e jobs agendados.
  const app = await NestFactory.createApplicationContext(WorkerModule);
  app.enableShutdownHooks();
  Logger.log('Worker de ingestão iniciado', 'Bootstrap');
}

void bootstrap();
