import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { APP_CONFIG, type AppConfig } from './config/config.module';
import { DeputadosSyncService } from './sync/deputados-sync.service';
import { DespesasSyncService } from './sync/despesas-sync.service';
import { CliModule } from './worker.module';

const USO = `Uso: pnpm --filter @raio-x/worker sync <comando>

Comandos:
  inicial              deputados + despesas dos anos em SYNC_INITIAL_YEARS
  deputados            sincroniza os deputados da legislatura configurada
  despesas <ano...>    sincroniza as despesas dos anos informados`;

/** Executa sincronizações sob demanda, sem passar pela fila (carga inicial, depuração). */
async function main(): Promise<void> {
  const [comando, ...args] = process.argv.slice(2);
  if (!comando || !['inicial', 'deputados', 'despesas'].includes(comando)) {
    console.error(USO);
    process.exitCode = 1;
    return;
  }

  const app = await NestFactory.createApplicationContext(CliModule, {
    logger: ['log', 'warn', 'error'],
  });
  try {
    const deputados = app.get(DeputadosSyncService);
    const despesas = app.get(DespesasSyncService);
    const config = app.get<AppConfig>(APP_CONFIG);

    if (comando === 'inicial' || comando === 'deputados') await deputados.sincronizar();

    const anos =
      comando === 'inicial'
        ? config.SYNC_INITIAL_YEARS
        : comando === 'despesas'
          ? args.map(Number)
          : [];
    if (comando === 'despesas' && (anos.length === 0 || anos.some((a) => !Number.isInteger(a)))) {
      throw new Error('Informe ao menos um ano válido. Ex.: despesas 2025 2026');
    }
    for (const ano of anos) await despesas.sincronizarAno(ano);
  } catch (error) {
    Logger.error(error instanceof Error ? error.message : String(error), 'CLI');
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}

void main();
