import { Module } from '@nestjs/common';
import { CamaraModule } from '../camara/camara.module';
import { HttpClient } from '../comum/http-client';
import { APP_CONFIG, type AppConfig } from '../config/config.module';
import { SenadoApiClient } from './senado-api.client';

@Module({
  imports: [CamaraModule],
  providers: [
    {
      provide: SenadoApiClient,
      inject: [HttpClient, APP_CONFIG],
      useFactory: (http: HttpClient, config: AppConfig) =>
        new SenadoApiClient(http, config.SENADO_API_BASE_URL),
    },
  ],
  exports: [SenadoApiClient, CamaraModule],
})
export class SenadoModule {}
