import { Module } from '@nestjs/common';
import { HttpClient } from '../comum/http-client';
import { USER_AGENT } from '../comum/user-agent';
import { APP_CONFIG, type AppConfig } from '../config/config.module';
import { PortalTransparenciaClient } from './portal-transparencia.client';

/** Cliente do Portal, ou `null` quando TRANSPARENCIA_API_KEY não está configurada. */
export const PORTAL_TRANSPARENCIA = Symbol('PORTAL_TRANSPARENCIA');

@Module({
  providers: [
    {
      provide: PORTAL_TRANSPARENCIA,
      inject: [APP_CONFIG],
      // HttpClient próprio: outra chave e outro limite de taxa que os da Câmara/Senado.
      useFactory: (config: AppConfig): PortalTransparenciaClient | null =>
        config.TRANSPARENCIA_API_KEY
          ? new PortalTransparenciaClient(
              new HttpClient({
                userAgent: USER_AGENT,
                requestsPerSecond: config.TRANSPARENCIA_RATE_LIMIT_PER_SECOND,
                headers: { 'chave-api-dados': config.TRANSPARENCIA_API_KEY },
              }),
              config.TRANSPARENCIA_API_BASE_URL,
            )
          : null,
    },
  ],
  exports: [PORTAL_TRANSPARENCIA],
})
export class TransparenciaModule {}
