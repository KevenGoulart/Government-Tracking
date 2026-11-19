import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { FONTES_SYNC, type SyncStatus, syncStatusSchema } from '@raio-x/shared';
import { ApiZodOk } from '../common/swagger-zod';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('meta')
@Controller('meta')
export class MetaController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('sync')
  @ApiOperation({ summary: 'Data da última sincronização bem-sucedida de cada fonte' })
  @ApiZodOk(syncStatusSchema)
  async sync(): Promise<SyncStatus> {
    const fontes = await Promise.all(
      Object.values(FONTES_SYNC).map(async (fonte) => {
        const ultima = await this.prisma.syncRun.findFirst({
          where: { fonte, status: 'SUCCESS' },
          orderBy: { fim: 'desc' },
          select: { fim: true },
        });
        return { fonte, ultimaSincronizacao: ultima?.fim?.toISOString() ?? null };
      }),
    );
    const datas = fontes.map((f) => f.ultimaSincronizacao);
    const atualizadoEm = datas.every((d): d is string => d !== null)
      ? datas.reduce((a, b) => (a < b ? a : b))
      : null;
    return { fontes, atualizadoEm };
  }
}
