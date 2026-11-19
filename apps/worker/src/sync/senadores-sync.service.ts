import { Inject, Injectable, Logger } from '@nestjs/common';
import { FONTES_SYNC, normalizarParaBusca } from '@raio-x/shared';
import { APP_CONFIG, type AppConfig } from '../config/config.module';
import { PrismaService } from '../prisma/prisma.service';
import { type Senador, SenadoApiClient } from '../senado/senado-api.client';
import { type ResultadoSync, SyncRunService } from './sync-run.service';

/**
 * Sincroniza os senadores da legislatura configurada (titulares e suplentes que tiveram
 * mandato). A lista da legislatura não traz partido; o detalhe individual é buscado só
 * para quem ainda não tem nome civil salvo, como na Câmara.
 */
@Injectable()
export class SenadoresSyncService {
  private readonly logger = new Logger(SenadoresSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly api: SenadoApiClient,
    private readonly syncRun: SyncRunService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  sincronizar(): Promise<ResultadoSync> {
    const legislatura = this.config.SENADO_LEGISLATURA;
    return this.syncRun.executar(FONTES_SYNC.SENADO_SENADORES, { legislatura }, () =>
      this.executar(legislatura),
    );
  }

  private async executar(legislatura: number): Promise<ResultadoSync> {
    const daLegislatura = await this.api.listarDaLegislatura(legislatura);
    const emExercicio = await this.api.listarEmExercicio();
    const ativos = new Map(emExercicio.map((s) => [s.codigo, s]));
    const porCodigo = new Map([...daLegislatura, ...emExercicio].map((s) => [s.codigo, s]));

    const existentes = await this.prisma.parlamentar.findMany({
      where: { casa: 'SENADO' },
      select: { idExterno: true, nomeCivil: true },
    });
    const comNomeCivil = new Set(existentes.filter((p) => p.nomeCivil).map((p) => p.idExterno));

    let detalhesBuscados = 0;
    for (const basico of porCodigo.values()) {
      // A lista de em exercício já traz partido e foto; para os demais, busca o detalhe uma vez.
      let senador: Senador = ativos.get(basico.codigo) ?? basico;
      if (!ativos.has(basico.codigo) && !comNomeCivil.has(basico.codigo)) {
        senador = { ...basico, ...semNulos(await this.api.obterSenador(basico.codigo)) };
        detalhesBuscados++;
      }

      const dados = {
        nome: senador.nome,
        nomeBusca: normalizarParaBusca(senador.nome),
        partido: senador.partido,
        uf: senador.uf ?? 'NA',
        fotoUrl: senador.fotoUrl,
        email: senador.email,
        emExercicio: ativos.has(senador.codigo),
        ...(senador.nomeCompleto && { nomeCivil: senador.nomeCompleto }),
      };
      // Sem partido no detalhe, mantém o que já estava salvo em vez de apagar.
      const atualizacao = dados.partido ? dados : { ...dados, partido: undefined };

      await this.prisma.parlamentar.upsert({
        where: { casa_idExterno: { casa: 'SENADO', idExterno: senador.codigo } },
        create: { casa: 'SENADO', idExterno: senador.codigo, ...dados },
        update: atualizacao,
      });
    }

    // Quem não exerceu mandato na legislatura e não tem despesas não deve aparecer como
    // senador (ex.: suplente que nunca assumiu, muitas vezes deputado federal).
    const { count: removidos } = await this.prisma.parlamentar.deleteMany({
      where: {
        casa: 'SENADO',
        idExterno: { notIn: [...porCodigo.keys()] },
        despesas: { none: {} },
      },
    });

    const { count: inativados } = await this.prisma.parlamentar.updateMany({
      where: { casa: 'SENADO', emExercicio: true, idExterno: { notIn: [...ativos.keys()] } },
      data: { emExercicio: false },
    });

    this.logger.log(
      `${porCodigo.size} senadores, ${ativos.size} em exercício, ${detalhesBuscados} detalhes buscados`,
    );
    return {
      processados: porCodigo.size,
      detalhes: { emExercicio: ativos.size, detalhesBuscados, inativados, removidos },
    };
  }
}

function semNulos(senador: Senador): Partial<Senador> {
  return Object.fromEntries(Object.entries(senador).filter(([, v]) => v !== null));
}
