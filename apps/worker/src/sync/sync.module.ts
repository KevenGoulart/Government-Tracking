import { Module } from '@nestjs/common';
import { CamaraModule } from '../camara/camara.module';
import { DeputadosSyncService } from './deputados-sync.service';
import { DespesasSyncService } from './despesas-sync.service';
import { DespesasRepository } from './despesas.repository';
import { SyncRunService } from './sync-run.service';

/** Serviços de sincronização, usados tanto pelo worker (fila) quanto pela CLI. */
@Module({
  imports: [CamaraModule],
  providers: [SyncRunService, DespesasRepository, DeputadosSyncService, DespesasSyncService],
  exports: [DeputadosSyncService, DespesasSyncService],
})
export class SyncModule {}
