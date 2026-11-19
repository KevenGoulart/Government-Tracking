import { Inject, Injectable, Logger } from '@nestjs/common';
import { Redis } from 'ioredis';
import { REDIS } from '../common/redis.module';
import { APP_CONFIG, type AppConfig } from '../config/config.module';
import { PrismaService } from '../prisma/prisma.service';

/** Por quanto tempo a versão dos dados fica memorizada no processo antes de reconsultar. */
const VERSAO_TTL_MS = 30_000;

/**
 * Cache de respostas agregadas no Redis.
 *
 * As chaves incluem a "versão dos dados" (fim da última sincronização bem-sucedida):
 * quando o worker termina uma sincronização, todas as chaves antigas deixam de ser lidas
 * e expiram sozinhas pelo TTL. Não há invalidação manual a coordenar entre os processos.
 *
 * As chaves também incluem a versão do código (APP_VERSION, ou o início do processo):
 * um deploy que muda o formato das respostas nunca lê entradas gravadas pela versão anterior.
 *
 * Falhas do Redis não derrubam a API: a resposta é calculada direto do banco.
 */
@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);
  private versao: { valor: string; expiraEm: number } | null = null;
  private readonly versaoCodigo: string;

  constructor(
    @Inject(REDIS) private readonly redis: Redis,
    private readonly prisma: PrismaService,
    @Inject(APP_CONFIG) config: Pick<AppConfig, 'APP_VERSION'>,
  ) {
    this.versaoCodigo = config.APP_VERSION ?? `inicio-${Date.now()}`;
  }

  async obterOuCalcular<T>(
    chave: string,
    ttlSegundos: number,
    calcular: () => Promise<T>,
  ): Promise<T> {
    const chaveCompleta = `cache:${this.versaoCodigo}:${await this.versaoDados()}:${chave}`;

    const salvo = await this.executar(() => this.redis.get(chaveCompleta));
    if (salvo) return JSON.parse(salvo) as T;

    const valor = await calcular();
    await this.executar(() =>
      this.redis.set(chaveCompleta, JSON.stringify(valor), 'EX', ttlSegundos),
    );
    return valor;
  }

  private async versaoDados(): Promise<string> {
    const agora = Date.now();
    if (this.versao && this.versao.expiraEm > agora) return this.versao.valor;

    const ultima = await this.prisma.syncRun.findFirst({
      where: { status: 'SUCCESS' },
      orderBy: { fim: 'desc' },
      select: { fim: true },
    });
    const valor = ultima?.fim ? String(ultima.fim.getTime()) : '0';
    this.versao = { valor, expiraEm: agora + VERSAO_TTL_MS };
    return valor;
  }

  private async executar<T>(operacao: () => Promise<T>): Promise<T | null> {
    try {
      if (this.redis.status === 'wait') await this.redis.connect();
      return await operacao();
    } catch (error) {
      this.logger.warn(
        `Cache indisponível: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }
}
