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
    const zip = await this.http.getBytes(url);
    const { porDeputado, ignoradas, total } = await this.agrupar(extrairCsvDoZip(zip), ano);

    if (porDeputado.size === 0) {
      // Proteção: um arquivo vazio ou truncado não pode apagar o ano inteiro do banco.
      throw new Error(
        `Arquivo da cota de ${ano} não contém despesas de deputados (${total} linhas)`,
      );
    }

    const categorias = new Map<string, string>();
    const fornecedores = new Map<string, FornecedorDaCota>();
    const parlamentares = new Map<string, ParlamentarDaCota>();
    for (const [ideCadastro, despesas] of porDeputado) {
      for (const d of despesas) {
        categorias.set(d.categoria.slug, d.categoria.nome);
        if (!fornecedores.has(d.fornecedor.chave)) {
          const { documento, nome, nomeNormalizado } = d.fornecedor;
          fornecedores.set(d.fornecedor.chave, { documento, nome, nomeNormalizado });
        }
      }
      const primeira = despesas[0];
      if (primeira) parlamentares.set(ideCadastro, primeira.parlamentar);
    }

    const idsCategoria = await this.repository.garantirCategorias(categorias);
    const idsFornecedor = await this.repository.garantirFornecedores(fornecedores);
    const idsParlamentar = await this.repository.garantirParlamentares(parlamentares);

    let inseridas = 0;
    let removidas = 0;
    let processadas = 0;
    for (const [ideCadastro, despesas] of porDeputado) {
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

    this.logger.log(
      `Cota ${ano}: ${processadas} despesas de ${porDeputado.size} deputados ` +
        `(${inseridas} novas, ${removidas} removidas, ${ignoradas} de lideranças ignoradas)`,
    );
    return {
      processados: processadas,
      detalhes: { inseridas, removidas, ignoradas, deputados: porDeputado.size },
    };
  }

  private async agrupar(csv: Uint8Array, ano: number) {
    const porDeputado = new Map<string, DespesaCota[]>();
    let ignoradas = 0;
    let total = 0;
    for await (const linha of lerLinhasCota(csv)) {
      total++;
      const despesa = mapearLinhaCota(linha);
      if (!despesa) {
        ignoradas++;
        continue;
      }
      if (despesa.ano !== ano) {
        throw new Error(`Linha ${total} pertence a ${despesa.ano}, esperado ${ano}`);
      }
      const lista = porDeputado.get(despesa.ideCadastro);
      if (lista) lista.push(despesa);
      else porDeputado.set(despesa.ideCadastro, [despesa]);
    }
    return { porDeputado, ignoradas, total };
  }
}
