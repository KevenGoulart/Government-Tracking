import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@raio-x/db';
import { PrismaService } from '../prisma/prisma.service';

export interface ResultadoSync {
  processados: number;
  detalhes?: Prisma.InputJsonObject;
}

/** Registra cada execução de sincronização na tabela SyncRun (início, fim, status, contagens, erro). */
@Injectable()
export class SyncRunService {
  private readonly logger = new Logger(SyncRunService.name);

  constructor(private readonly prisma: PrismaService) {}

  async executar(
    fonte: string,
    escopo: Prisma.InputJsonObject | undefined,
    tarefa: () => Promise<ResultadoSync>,
  ): Promise<ResultadoSync> {
    const run = await this.prisma.syncRun.create({ data: { fonte, escopo } });
    const rotulo = `${fonte}${escopo ? ` ${JSON.stringify(escopo)}` : ''}`;
    this.logger.log(`Iniciando ${rotulo}`);

    try {
      const resultado = await tarefa();
      await this.prisma.syncRun.update({
        where: { id: run.id },
        data: {
          status: 'SUCCESS',
          fim: new Date(),
          processados: resultado.processados,
          detalhes: resultado.detalhes,
        },
      });
      this.logger.log(`Concluído ${rotulo}: ${resultado.processados} registros`);
      return resultado;
    } catch (error) {
      const mensagem = error instanceof Error ? error.message : String(error);
      await this.prisma.syncRun.update({
        where: { id: run.id },
        data: { status: 'FAILED', fim: new Date(), erro: mensagem.slice(0, 2_000) },
      });
      this.logger.error(`Falhou ${rotulo}: ${mensagem}`);
      throw error;
    }
  }
}
