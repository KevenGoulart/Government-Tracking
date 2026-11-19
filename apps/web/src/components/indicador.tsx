import { Card, CardHeader } from '@/components/ui/card';

/** Número de destaque com rótulo (stat tile). */
export function Indicador({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <Card>
      <CardHeader>
        <p className="text-muted-foreground text-sm">{rotulo}</p>
        <p className="text-3xl font-semibold tracking-tight">{valor}</p>
      </CardHeader>
    </Card>
  );
}
