import { Module } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../config/config.module';
import { CamaraApiClient } from './camara-api.client';
import { HttpClient } from '../comum/http-client';
import { USER_AGENT } from '../comum/user-agent';

@Module({
  providers: [
    {
      provide: HttpClient,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) =>
        new HttpClient({
          userAgent: USER_AGENT,
          requestsPerSecond: config.CAMARA_RATE_LIMIT_PER_SECOND,
        }),
    },
    {
      provide: CamaraApiClient,
      inject: [HttpClient, APP_CONFIG],
      useFactory: (http: HttpClient, config: AppConfig) =>
        new CamaraApiClient(http, config.CAMARA_API_BASE_URL),
    },
  ],
  exports: [HttpClient, CamaraApiClient],
})
export class CamaraModule {}
