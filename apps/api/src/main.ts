import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { setupApp } from './app.setup';
import { APP_CONFIG, type AppConfig } from './config/config.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  setupApp(app);
  const { API_PORT } = app.get<AppConfig>(APP_CONFIG);
  await app.listen(API_PORT);
  Logger.log(`API em http://localhost:${API_PORT} (docs em /docs)`, 'Bootstrap');
}

void bootstrap();
