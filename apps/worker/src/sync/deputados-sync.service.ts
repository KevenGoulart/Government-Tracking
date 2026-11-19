import { Inject, Injectable, Logger } from '@nestjs/common';
import { FONTES_SYNC, normalizarParaBusca } from '@raio-x/shared';
import { CamaraApiClient, type DeputadoDetalhe } from '../camara/camara-api.client';
import { APP_CONFIG, type AppConfig } from '../config/config.module';
import { PrismaService } from '../prisma/prisma.service';
import { type ResultadoSync, SyncRunService } from './sync-run.service';

/**
 * Sincroniza os deputados da legislatura configurada.
 * - Lista da legislatura: todos que exerceram mandato (titulares e suplentes).
 * - Lista sem filtro: apenas quem está em exercício hoje (define `emExercicio`).
 * - Detalhe individual: só para quem ainda não tem nome civil (evita ~600 chamadas por execução).
 */
@Injectable()
export class DeputadosSyncService {
  private readonly logger = new Logger(DeputadosSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly api: CamaraApiClient,
    private readonly syncRun: SyncRunService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  sincronizar(): Promise<ResultadoSync> {
    const legislatura = this.config.CAMARA_LEGISLATURA;
    return this.syncRun.executar(FONTES_SYNC.CAMARA_DEPUTADOS, { legislatura }, () =>
      this.executar(legislatura),
    );
  }

  private async executar(idLegislatura: number): Promise<ResultadoSync> {
    const todos = await this.api.listarDeputados({ idLegislatura });
    const emExercicio = new Set((await this.api.listarDeputados()).map((d) => d.id));

    // A lista pode repetir o mesmo deputado (uma entrada por mudança de status).
    const porId = new Map(todos.map((d) => [d.id, d]));

    const existentes = await this.prisma.parlamentar.findMany({
      where: { casa: 'CAMARA' },
      select: { idExterno: true, nomeCivil: true },
    });
    const comNomeCivil = new Set(existentes.filter((p) => p.nomeCivil).map((p) => p.idExterno));

    let detalhesBuscados = 0;
    for (const deputado of porId.values()) {
      const idExterno = String(deputado.id);
      let detalhe: DeputadoDetalhe | undefined;
      if (!comNomeCivil.has(idExterno)) {
        detalhe = await this.api.obterDeputado(deputado.id);
        detalhesBuscados++;
      }

      const status = detalhe?.ultimoStatus;
      const nome = status?.nome ?? deputado.nome;
      const dados = {
        nome,
        nomeBusca: normalizarParaBusca(nome),
        partido: status?.siglaPartido ?? deputado.siglaPartido,
        uf: status?.siglaUf ?? deputado.siglaUf ?? 'NA',
        fotoUrl: status?.urlFoto ?? deputado.urlFoto,
        email: status?.email ?? deputado.email,
        emExercicio: emExercicio.has(deputado.id),
        ...(detalhe?.nomeCivil && { nomeCivil: detalhe.nomeCivil }),
      };

      await this.prisma.parlamentar.upsert({
        where: { casa_idExterno: { casa: 'CAMARA', idExterno } },
        create: { casa: 'CAMARA', idExterno, ...dados },
        update: dados,
      });
    }

    // Quem não aparece mais entre os em exercício (ex.: suplente que deixou o cargo)
    const { count: inativados } = await this.prisma.parlamentar.updateMany({
      where: {
        casa: 'CAMARA',
        emExercicio: true,
        idExterno: { notIn: [...emExercicio].map(String) },
      },
      data: { emExercicio: false },
    });

    this.logger.log(
      `${porId.size} deputados, ${emExercicio.size} em exercício, ${detalhesBuscados} detalhes buscados`,
    );
    return {
      processados: porId.size,
      detalhes: { emExercicio: emExercicio.size, detalhesBuscados, inativados },
    };
  }
}
