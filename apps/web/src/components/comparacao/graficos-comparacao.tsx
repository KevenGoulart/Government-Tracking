'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  Tooltip,
  type TooltipContentProps,
  XAxis,
  YAxis,
} from 'recharts';
import { formatarMoeda, formatarMoedaCompacta, nomeMes, nomeMesCurto } from '@/lib/format';
import type { Serie } from './series';

/** Uma linha por mês ou categoria, com uma coluna (id do parlamentar) por série. */
export type LinhaComparacao = { rotulo: string } & Record<string, number | string>;

const eixo = { fill: 'var(--muted-foreground)', fontSize: 12 };

interface DicaProps {
  active?: boolean;
  label?: string | number;
  payload?: ReadonlyArray<{ dataKey?: unknown; value?: unknown }>;
  series: Serie[];
  formatarRotulo: (rotulo: string) => string;
}

function Dica({ active, label, payload, series, formatarRotulo }: DicaProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-popover text-popover-foreground space-y-1 rounded-md border px-3 py-2 text-sm shadow-md">
      <p className="text-muted-foreground">{formatarRotulo(String(label))}</p>
      {series.map((s) => {
        const item = payload.find((p) => p.dataKey === s.id);
        return (
          <p key={s.id} className="flex items-center gap-2">
            <span aria-hidden className="size-2.5 rounded-sm" style={{ backgroundColor: s.cor }} />
            <span className="flex-1">{s.nome}</span>
            <span className="font-medium tabular-nums">
              {formatarMoeda(Number(item?.value ?? 0))}
            </span>
          </p>
        );
      })}
    </div>
  );
}

/** Evolução mensal: uma linha de 2px por parlamentar, tooltip com todos os valores do mês. */
export function ComparacaoMensalChart({
  dados,
  series,
}: {
  dados: LinhaComparacao[];
  series: Serie[];
}) {
  return (
    <div className="h-72 w-full" aria-hidden>
      <LineChart
        data={dados}
        margin={{ top: 8, right: 16, bottom: 0, left: 8 }}
        responsive
        accessibilityLayer={false}
        style={{ width: '100%', height: '100%' }}
      >
        <CartesianGrid vertical={false} stroke="var(--viz-grid)" />
        <XAxis
          dataKey="rotulo"
          tickFormatter={(mes: string) => nomeMesCurto(Number(mes))}
          tickLine={false}
          axisLine={false}
          tick={eixo}
        />
        <YAxis
          tickFormatter={(v: number) => formatarMoedaCompacta(v)}
          tickLine={false}
          axisLine={false}
          width={72}
          tick={eixo}
        />
        <Tooltip
          content={(props: TooltipContentProps) => (
            <Dica
              active={props.active}
              label={props.label}
              payload={props.payload}
              series={series}
              formatarRotulo={(mes) => nomeMes(Number(mes))}
            />
          )}
          cursor={{ stroke: 'var(--muted-foreground)', strokeWidth: 1 }}
        />
        {series.map((s) => (
          <Line
            key={s.id}
            dataKey={s.id}
            stroke={s.cor}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--background)' }}
            isAnimationActive={false}
          />
        ))}
      </LineChart>
    </div>
  );
}

/** Categorias: barras horizontais agrupadas, uma por parlamentar, com 2px de espaço entre elas. */
export function ComparacaoCategoriasChart({
  dados,
  series,
}: {
  dados: LinhaComparacao[];
  series: Serie[];
}) {
  const altura = Math.max(240, dados.length * (series.length * 14 + 28));
  return (
    <div className="w-full" style={{ height: altura }} aria-hidden>
      <BarChart
        data={dados}
        layout="vertical"
        margin={{ top: 0, right: 16, bottom: 0, left: 8 }}
        barGap={2}
        responsive
        accessibilityLayer={false}
        style={{ width: '100%', height: '100%' }}
      >
        <CartesianGrid horizontal={false} stroke="var(--viz-grid)" />
        <XAxis
          type="number"
          tickFormatter={(v: number) => formatarMoedaCompacta(v)}
          tickLine={false}
          axisLine={false}
          tick={eixo}
        />
        <YAxis
          type="category"
          dataKey="rotulo"
          width={160}
          tickLine={false}
          axisLine={false}
          tick={eixo}
        />
        <Tooltip
          content={(props: TooltipContentProps) => (
            <Dica
              active={props.active}
              label={props.label}
              payload={props.payload}
              series={series}
              formatarRotulo={(rotulo) => rotulo}
            />
          )}
          cursor={{ fill: 'var(--muted)', opacity: 0.6 }}
        />
        {series.map((s) => (
          <Bar
            key={s.id}
            dataKey={s.id}
            fill={s.cor}
            radius={[0, 4, 4, 0]}
            maxBarSize={12}
            isAnimationActive={false}
          />
        ))}
      </BarChart>
    </div>
  );
}
