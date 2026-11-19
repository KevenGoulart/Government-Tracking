import type { GastoMensal } from '@raio-x/shared';
import { formatarMoeda, nomeMes } from '@/lib/format';
import { GastosMensaisChart, type PontoMensal } from './gastos-mensais-chart';

/**
 * Completa os meses sem despesa com zero: de janeiro até dezembro em anos passados, ou
 * até o último mês com dado no ano corrente (evita barras "vazias" para meses futuros).
 */
export function completarMeses(
  gastos: GastoMensal[],
  ano: number,
  hoje = new Date(),
): PontoMensal[] {
  const porMes = new Map(gastos.filter((g) => g.ano === ano).map((g) => [g.mes, Number(g.total)]));
  const ultimoComDado = Math.max(0, ...porMes.keys());
  const ultimoMes = ano < hoje.getFullYear() ? 12 : Math.max(ultimoComDado, 1);
  return Array.from({ length: ultimoMes }, (_, i) => ({
    mes: i + 1,
    total: porMes.get(i + 1) ?? 0,
  }));
}

/**
 * No ano corrente, os meses recentes parecem "cair" porque os reembolsos são lançados
 * com atraso. Sem esse aviso o gráfico sugeriria uma redução de gastos que não houve.
 */
export function AvisoAnoEmAndamento() {
  return <>Ano em andamento: os meses mais recentes ainda recebem lançamentos.</>;
}

export function GastosMensais({ gastos, ano }: { gastos: GastoMensal[]; ano: number }) {
  const dados = completarMeses(gastos, ano);
  return (
    <figure className="space-y-2">
      <GastosMensaisChart dados={dados} />
      <div className="sr-only">
        <table>
          <caption>Gasto mensal em {ano}, por mês de competência</caption>
          <thead>
            <tr>
              <th scope="col">Mês</th>
              <th scope="col">Valor líquido</th>
            </tr>
          </thead>
          <tbody>
            {dados.map((d) => (
              <tr key={d.mes}>
                <td>{nomeMes(d.mes)}</td>
                <td>{formatarMoeda(d.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <figcaption className="text-muted-foreground text-xs">
        Valor líquido por mês de competência (mês em que a despesa foi lançada na cota).
        {ano === new Date().getFullYear() && (
          <>
            {' '}
            <AvisoAnoEmAndamento />
          </>
        )}
      </figcaption>
    </figure>
  );
}
