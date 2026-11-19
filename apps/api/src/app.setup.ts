import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { APP_CONFIG, type AppConfig } from './config/config.module';

/** Configuração compartilhada entre `main.ts` e os testes e2e. */
export function setupApp(app: INestApplication): void {
  const config = app.get<AppConfig>(APP_CONFIG);
  app.enableCors({ origin: config.CORS_ORIGIN.split(',').map((origin) => origin.trim()) });
  app.enableShutdownHooks();

  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('Raio-X Público API')
      .setDescription(
        'Gastos públicos de parlamentares brasileiros a partir de dados abertos oficiais.',
      )
      .setVersion('0.1.0')
      .build(),
  );
  SwaggerModule.setup('docs', app, document);
}
