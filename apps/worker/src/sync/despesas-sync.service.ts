import { Inject, Injectable, Logger } from '@nestjs/common';
import { FONTES_SYNC } from '@raio-x/shared';
import { extrairCsvDoZip, lerLinhasCota } from '../camara/cota-csv';
import { atribuirChaves, type DespesaCota, mapearLinhaCota } from '../camara/despesa-cota.mapper';
import { HttpClient } from '../comum/http-client';
import { APP_CONFIG, type AppConfig } from '../config/config.module';
import {
  DespesasRepository,
  type FornecedorDaCota,
  type ParlamentarDaCota,
} from './despesas.repository';
import { type ResultadoSync, SyncRunService } from './sync-run.service';

/**
 * Sincroniza as despesas da Cota Parlamentar (CEAP) de um ano a partir do arquivo anual
 * oficial da Câmara. O arquivo contém o ano inteiro, então cada execução espelha a fonte:
 * insere o que é novo e remove o que deixou de existir.
 *
 * Por que o CSV e não a API? A API `/deputados/{id}/despesas` retorna `valorLiquido` com
 * sinal invertido e exigiria ~2.000 requisições por ano; o CSV tem os valores corretos e é
 * um único download (ver docs/decisoes.md).
 */
@Injectable()
export class DespesasSyncService {
  private readonly logger = new Logger(DespesasSyncService.name);

  constructor(
    private readonly http: HttpClient,
    private readonly repository: DespesasRepository,
    private readonly syncRun: SyncRunService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  sincronizarAno(ano: number): Promise<ResultadoSync> {
    return this.syncRun.executar(FONTES_SYNC.CAMARA_DESPESAS, { ano }, () => this.executar(ano));
  }

  private async executar(ano: number): Promise<ResultadoSync> {
    const url = `${this.config.CAMARA_COTAS_BASE_URL}/Ano-${ano}.csv.zip`;
    const csv = extrairCsvDoZip(await this.http.getBytes(url));

    // 1ª passada: valida o arquivo inteiro e coleta categorias, fornecedores e deputados,
    // sem guardar as despesas. Nada é gravado antes de o arquivo todo ser lido.
    const analise = await this.analisar(csv, ano);
    if (analise.parlamentares.size === 0) {
      // Proteção: um arquivo vazio ou truncado não pode apagar o ano inteiro do banco.
      throw new Error(
        `Arquivo da cota de ${ano} não contém despesas de deputados (${analise.total} linhas)`,
      );
    }

    const idsCategoria = await this.repository.garantirCategorias(analise.categorias);
    const idsFornecedor = await this.repository.garantirFornecedores(analise.fornecedores);
    const idsParlamentar = await this.repository.garantirParlamentares(analise.parlamentares);

    // 2ª passada: um deputado por vez. O arquivo oficial vem agrupado por deputado, então
    // só as despesas de um deles ficam em memória (pico de ~1,4 GB → ~300 MB com o ano todo).
    if (!analise.agrupado) {
      this.logger.warn(`Arquivo da cota de ${ano} fora de ordem: agrupando em memória`);
    }
    const blocos = analise.agrupado ? this.blocosEmSequencia(csv) : this.blocosEmMemoria(csv);

    let inseridas = 0;
    let removidas = 0;
    let processadas = 0;
    for await (const [ideCadastro, despesas] of blocos) {
      const parlamentarId = idsParlamentar.get(ideCadastro);
      if (!parlamentarId) throw new Error(`Parlamentar ${ideCadastro} não encontrado após upsert`);

      const registros = atribuirChaves(despesas).map((d) => {
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

    removidas += await this.repository.removerDespesasDeAusentes('CAMARA', ano, [
      ...idsParlamentar.values(),
    ]);

    const { ignoradas, parlamentares } = analise;
    this.logger.log(
      `Cota ${ano}: ${processadas} despesas de ${parlamentares.size} deputados ` +
        `(${inseridas} novas, ${removidas} removidas, ${ignoradas} de lideranças ignoradas)`,
    );
    return {
      processados: processadas,
      detalhes: { inseridas, removidas, ignoradas, deputados: parlamentares.size },
    };
  }

  /** Despesas de deputados do arquivo (as de lideranças partidárias são descartadas). */
  private async *despesas(csv: Uint8Array): AsyncGenerator<DespesaCota> {
    for await (const linha of lerLinhasCota(csv)) {
      const despesa = mapearLinhaCota(linha);
      if (despesa) yield despesa;
    }
  }

  private async analisar(csv: Uint8Array, ano: number) {
    const categorias = new Map<string, string>();
    const fornecedores = new Map<string, FornecedorDaCota>();
    const parlamentares = new Map<string, ParlamentarDaCota>();
    let total = 0;
    let ignoradas = 0;
    let agrupado = true;
    let atual: string | null = null;

    for await (const linha of lerLinhasCota(csv)) {
      total++;
      const d = mapearLinhaCota(linha);
      if (!d) {
        ignoradas++;
        continue;
      }
      if (d.ano !== ano) throw new Error(`Linha ${total} pertence a ${d.ano}, esperado ${ano}`);

      if (d.ideCadastro !== atual) {
        // Um deputado que reaparece depois de outro: o arquivo não está agrupado.
        if (parlamentares.has(d.ideCadastro)) agrupado = false;
        else parlamentares.set(d.ideCadastro, d.parlamentar);
        atual = d.ideCadastro;
      }
      categorias.set(d.categoria.slug, d.categoria.nome);
      if (!fornecedores.has(d.fornecedor.chave)) {
        const { documento, nome, nomeNormalizado } = d.fornecedor;
        fornecedores.set(d.fornecedor.chave, { documento, nome, nomeNormalizado });
      }
    }
    return { categorias, fornecedores, parlamentares, total, ignoradas, agrupado };
  }

  /** Deputado a deputado, na ordem do arquivo (requer linhas agrupadas por deputado). */
  private async *blocosEmSequencia(csv: Uint8Array): AsyncGenerator<[string, DespesaCota[]]> {
    let bloco: DespesaCota[] = [];
    for await (const d of this.despesas(csv)) {
      const anterior = bloco[0];
      if (anterior && anterior.ideCadastro !== d.ideCadastro) {
        yield [anterior.ideCadastro, bloco];
        bloco = [];
      }
      bloco.push(d);
    }
    if (bloco[0]) yield [bloco[0].ideCadastro, bloco];
  }

  /** Alternativa para um arquivo fora de ordem: agrupa o ano inteiro em memória. */
  private async *blocosEmMemoria(csv: Uint8Array): AsyncGenerator<[string, DespesaCota[]]> {
    const porDeputado = new Map<string, DespesaCota[]>();
    for await (const d of this.despesas(csv)) {
      const lista = porDeputado.get(d.ideCadastro);
      if (lista) lista.push(d);
      else porDeputado.set(d.ideCadastro, [d]);
    }
    yield* porDeputado;
  }
}
