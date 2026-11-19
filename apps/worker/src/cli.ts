import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { APP_CONFIG, type AppConfig } from './config/config.module';
import { DeputadosSyncService } from './sync/deputados-sync.service';
import { DespesasSyncService } from './sync/despesas-sync.service';
import { EmendasSyncService } from './sync/emendas-sync.service';
import { SenadoDespesasSyncService } from './sync/senado-despesas-sync.service';
import { SenadoresSyncService } from './sync/senadores-sync.service';
import { CliModule } from './worker.module';

const USO = `Uso: pnpm --filter @raio-x/worker sync <comando> [anos...]

Comandos:
  inicial                     carga completa dos anos em SYNC_INITIAL_YEARS
                              (Câmara, Senado e, com a chave configurada, emendas)
  deputados                   deputados da legislatura configurada
  despesas <ano...>           despesas da Câmara (cota dos deputados)
  senadores                   senadores da legislatura configurada
  senado-despesas <ano...>    despesas do Senado (CEAPS)
  emendas <ano...>            emendas parlamentares (Portal da Transparência)`;

const COMANDOS = ['inicial', 'deputados', 'despesas', 'senadores', 'senado-despesas', 'emendas'];
const COM_ANOS = new Set(['despesas', 'senado-despesas', 'emendas']);

/** Executa sincronizações sob demanda, sem passar pela fila (carga inicial, depuração). */
async function main(): Promise<void> {
  const [comando, ...args] = process.argv.slice(2);
  if (!comando || !COMANDOS.includes(comando)) {
    console.error(USO);
    process.exitCode = 1;
    return;
  }
  const anos = args.map(Number);
  if (COM_ANOS.has(comando) && (anos.length === 0 || anos.some((a) => !Number.isInteger(a)))) {
    console.error(`Informe ao menos um ano válido. Ex.: ${comando} 2025 2026`);
    process.exitCode = 1;
    return;
  }

  const app = await NestFactory.createApplicationContext(CliModule, {
    logger: ['log', 'warn', 'error'],
  });
  try {
    const deputados = app.get(DeputadosSyncService);
    const despesas = app.get(DespesasSyncService);
    const senadores = app.get(SenadoresSyncService);
    const senadoDespesas = app.get(SenadoDespesasSyncService);
    const emendas = app.get(EmendasSyncService);
    const porAno = async (fn: (ano: number) => Promise<unknown>, lista: number[]) => {
      for (const ano of lista) await fn(ano);
    };

    switch (comando) {
      case 'inicial': {
        const iniciais = app.get<AppConfig>(APP_CONFIG).SYNC_INITIAL_YEARS;
        await deputados.sincronizar();
        await porAno((ano) => despesas.sincronizarAno(ano), iniciais);
        await senadores.sincronizar();
        await porAno((ano) => senadoDespesas.sincronizarAno(ano), iniciais);
        if (emendas.habilitado) await porAno((ano) => emendas.sincronizarAno(ano), iniciais);
        else Logger.warn('Emendas ignoradas: TRANSPARENCIA_API_KEY não configurada', 'CLI');
        break;
      }
      case 'deputados':
        await deputados.sincronizar();
        break;
      case 'despesas':
        await porAno((ano) => despesas.sincronizarAno(ano), anos);
        break;
      case 'senadores':
        await senadores.sincronizar();
        break;
      case 'senado-despesas':
        await porAno((ano) => senadoDespesas.sincronizarAno(ano), anos);
        break;
      case 'emendas':
        await porAno((ano) => emendas.sincronizarAno(ano), anos);
        break;
    }
  } catch (error) {
    Logger.error(error instanceof Error ? error.message : String(error), 'CLI');
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}

void main();
