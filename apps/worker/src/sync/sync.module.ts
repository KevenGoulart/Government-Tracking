import { Module } from '@nestjs/common';
import { SenadoModule } from '../senado/senado.module';
import { TransparenciaModule } from '../transparencia/transparencia.module';
import { DeputadosSyncService } from './deputados-sync.service';
import { DespesasSyncService } from './despesas-sync.service';
import { DespesasRepository } from './despesas.repository';
import { EmendasSyncService } from './emendas-sync.service';
import { SenadoDespesasSyncService } from './senado-despesas-sync.service';
import { SenadoresSyncService } from './senadores-sync.service';
import { SyncRunService } from './sync-run.service';

const SERVICOS = [
  DeputadosSyncService,
  DespesasSyncService,
  SenadoresSyncService,
  SenadoDespesasSyncService,
  EmendasSyncService,
];

/** Serviços de sincronização, usados tanto pelo worker (fila) quanto pela CLI. */
@Module({
  imports: [SenadoModule, TransparenciaModule],
  providers: [SyncRunService, DespesasRepository, ...SERVICOS],
  exports: SERVICOS,
})
export class SyncModule {}
