import { Inject, Injectable, Logger } from '@nestjs/common';
import { FONTES_SYNC } from '@raio-x/shared';
import { HttpClient } from '../comum/http-client';
import { IndiceNomes } from '../comum/indice-nomes';
import { APP_CONFIG, type AppConfig } from '../config/config.module';
import { PrismaService } from '../prisma/prisma.service';
import { type DespesaSenado, lerLinhasCeaps, mapearLinhaCeaps } from '../senado/ceaps-csv';
import { DespesasRepository, type FornecedorDaCota } from './despesas.repository';
import { type ResultadoSync, SyncRunService } from './sync-run.service';

/** Quantos nomes sem vínculo listar no SyncRun (para diagnóstico). */
const MAX_NOMES_DETALHE = 20;

/**
 * Sincroniza as despesas da CEAPS (cota dos senadores) de um ano a partir do CSV anual
 * oficial. O arquivo identifica o senador só pelo nome: o vínculo é feito com o índice de
 * nomes dos senadores já sincronizados. Nomes ambíguos ou desconhecidos ficam de fora e
 * são registrados no SyncRun, em vez de serem atribuídos à pessoa errada.
 */
@Injectable()
export class SenadoDespesasSyncService {
  private readonly logger = new Logger(SenadoDespesasSyncService.name);

  constructor(
    private readonly http: HttpClient,
    private readonly prisma: PrismaService,
    private readonly repository: DespesasRepository,
    private readonly syncRun: SyncRunService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  sincronizarAno(ano: number): Promise<ResultadoSync> {
    return this.syncRun.executar(FONTES_SYNC.SENADO_DESPESAS, { ano }, () => this.executar(ano));
  }

  private async executar(ano: number): Promise<ResultadoSync> {
    const senadores = await this.prisma.parlamentar.findMany({
      where: { casa: 'SENADO' },
      select: { id: true, nome: true, nomeCivil: true },
    });
    if (senadores.length === 0) {
      throw new Error('Nenhum senador no banco: sincronize os senadores antes das despesas');
    }
    const indice = new IndiceNomes(senadores);

    const arquivo = await this.http.getBytes(
      `${this.config.SENADO_CEAPS_BASE_URL}/despesa_ceaps_${ano}.csv`,
    );
    const porNome = new Map<string, DespesaSenado[]>();
    for await (const linha of lerLinhasCeaps(arquivo)) {
      const despesa = mapearLinhaCeaps(linha);
      if (despesa.ano !== ano) throw new Error(`Linha de ${despesa.ano} no arquivo de ${ano}`);
      porNome.set(despesa.senador, [...(porNome.get(despesa.senador) ?? []), despesa]);
    }
    if (porNome.size === 0) throw new Error(`Arquivo da CEAPS de ${ano} sem despesas`);

    // Resolve cada nome do arquivo para um senador
    const porParlamentar = new Map<string, DespesaSenado[]>();
    const semVinculo: { nome: string; motivo: string; linhas: number }[] = [];
    for (const [nome, despesas] of porNome) {
      const resultado = indice.resolver(nome);
      if (resultado.status === 'encontrado') {
        porParlamentar.set(resultado.id, [
          ...(porParlamentar.get(resultado.id) ?? []),
          ...despesas,
        ]);
      } else {
        semVinculo.push({ nome, motivo: resultado.status, linhas: despesas.length });
      }
    }

    const categorias = new Map<string, string>();
    const fornecedores = new Map<string, FornecedorDaCota>();
    for (const despesas of porParlamentar.values()) {
      for (const d of despesas) {
        categorias.set(d.categoria.slug, d.categoria.nome);
        const { chave, documento, nome, nomeNormalizado } = d.fornecedor;
        if (!fornecedores.has(chave)) fornecedores.set(chave, { documento, nome, nomeNormalizado });
      }
    }
    const idsCategoria = await this.repository.garantirCategorias(categorias, 'SENADO');
    const idsFornecedor = await this.repository.garantirFornecedores(fornecedores);

    let inseridas = 0;
    let removidas = 0;
    let processadas = 0;
    for (const [parlamentarId, despesas] of porParlamentar) {
      const registros = despesas.map((d) => {
        const categoriaId = idsCategoria.get(d.categoria.slug);
        if (!categoriaId) throw new Error(`Categoria ${d.categoria.slug} não encontrada`);
        return DespesasRepository.paraGravacao(d, {
          parlamentarId,
          categoriaId,
          fornecedorId: idsFornecedor.get(d.fornecedor.chave),
        });
      });
      const resultado = await this.repository.substituirDespesasDoAno(
        parlamentarId,
        ano,
        registros,
      );
      inseridas += resultado.inseridas;
      removidas += resultado.removidas;
      processadas += registros.length;
    }
    removidas += await this.repository.removerDespesasDeAusentes('SENADO', ano, [
      ...porParlamentar.keys(),
    ]);

    const linhasSemVinculo = semVinculo.reduce((soma, s) => soma + s.linhas, 0);
    if (semVinculo.length > 0) {
      this.logger.warn(
        `CEAPS ${ano}: ${linhasSemVinculo} linhas sem vínculo (${semVinculo.map((s) => `${s.nome}: ${s.motivo}`).join('; ')})`,
      );
    }
    this.logger.log(
      `CEAPS ${ano}: ${processadas} despesas de ${porParlamentar.size} senadores ` +
        `(${inseridas} novas, ${removidas} removidas)`,
    );
    return {
      processados: processadas,
      detalhes: {
        inseridas,
        removidas,
        senadores: porParlamentar.size,
        linhasSemVinculo,
        semVinculo: semVinculo.slice(0, MAX_NOMES_DETALHE),
      },
    };
  }
}
