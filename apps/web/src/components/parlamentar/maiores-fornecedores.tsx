import type { TotalFornecedor } from '@raio-x/shared';
import Link from 'next/link';
import { formatarDocumento, formatarMoeda } from '@/lib/format';
import { hrefFornecedor } from '@/lib/links';

export function MaioresFornecedores({ fornecedores }: { fornecedores: TotalFornecedor[] }) {
  if (fornecedores.length === 0) {
    return <p className="text-muted-foreground text-sm">Nenhum fornecedor no período.</p>;
  }
  return (
    <ol className="divide-y">
      {fornecedores.map((f, i) => (
        <li key={f.id} className="flex items-baseline gap-3 py-2 text-sm">
          <span className="text-muted-foreground w-5 shrink-0 tabular-nums">{i + 1}.</span>
          <div className="min-w-0 flex-1">
            <Link
              href={hrefFornecedor(f)}
              className="block truncate font-medium underline-offset-4 hover:underline"
              title={f.nome}
            >
              {f.nome}
            </Link>
            <p className="text-muted-foreground text-xs tabular-nums">
              {f.documento ? formatarDocumento(f.documento) : 'Documento não informado'}
            </p>
          </div>
          <span className="shrink-0 tabular-nums">{formatarMoeda(f.total)}</span>
        </li>
      ))}
    </ol>
  );
}
