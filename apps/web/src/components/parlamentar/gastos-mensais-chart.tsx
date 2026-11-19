'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Tooltip,
  type TooltipContentProps,
  XAxis,
  YAxis,
} from 'recharts';
import { formatarMoeda, formatarMoedaCompacta, nomeMes, nomeMesCurto } from '@/lib/format';

export interface PontoMensal {
  mes: number;
  total: number;
}

interface DicaProps {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: unknown }>;
}

function Dica({ active, payload }: DicaProps) {
  const ponto = payload?.[0]?.payload as PontoMensal | undefined;
  if (!active || !ponto) return null;
  return (
    <div className="bg-popover text-popover-foreground rounded-md border px-3 py-2 text-sm shadow-md">
      <p className="text-muted-foreground capitalize">{nomeMes(ponto.mes)}</p>
      <p className="font-medium tabular-nums">{formatarMoeda(ponto.total)}</p>
    </div>
  );
}

/**
 * Evolução mensal (série única, uma cor): barras finas com cantos arredondados na ponta,
 * grade discreta e tooltip ao passar o mouse. A mesma informação existe em tabela para
 * leitores de tela (ver GastosMensais).
 */
export function GastosMensaisChart({ dados }: { dados: PontoMensal[] }) {
  return (
    <div className="h-64 w-full" aria-hidden>
      <BarChart
        data={dados}
        margin={{ top: 8, right: 8, bottom: 0, left: 8 }}
        responsive
        accessibilityLayer={false}
        style={{ width: '100%', height: '100%' }}
      >
        <CartesianGrid vertical={false} stroke="var(--viz-grid)" />
        <XAxis
          dataKey="mes"
          tickFormatter={(mes: number) => nomeMesCurto(mes)}
          tickLine={false}
          axisLine={false}
          tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
        />
        <YAxis
          tickFormatter={(valor: number) => formatarMoedaCompacta(valor)}
          tickLine={false}
          axisLine={false}
          width={72}
          tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
        />
        <Tooltip
          content={(props: TooltipContentProps) => (
            <Dica active={props.active} payload={props.payload} />
          )}
          cursor={{ fill: 'var(--muted)', opacity: 0.6 }}
        />
        <Bar dataKey="total" fill="var(--viz-series-1)" radius={[4, 4, 0, 0]} maxBarSize={24} />
      </BarChart>
    </div>
  );
}
