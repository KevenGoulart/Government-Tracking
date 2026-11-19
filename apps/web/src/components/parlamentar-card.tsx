import type { ParlamentarResumo } from '@raio-x/shared';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { CASAS } from '@/lib/casa';
import { FotoParlamentar } from './foto-parlamentar';

export function ParlamentarCard({ parlamentar }: { parlamentar: ParlamentarResumo }) {
  return (
    <li>
      <Link
        href={`/parlamentares/${parlamentar.id}`}
        className="hover:bg-muted/50 focus-visible:ring-ring/50 flex items-center gap-4 rounded-lg border p-4 transition-colors outline-none focus-visible:ring-3"
      >
        <FotoParlamentar nome={parlamentar.nome} fotoUrl={parlamentar.fotoUrl} tamanho={56} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{parlamentar.nome}</p>
          <p className="text-muted-foreground text-sm">
            {[CASAS[parlamentar.casa].cargo, parlamentar.partido, parlamentar.uf]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
        <Badge variant={parlamentar.emExercicio ? 'secondary' : 'outline'}>
          {parlamentar.emExercicio ? 'Em exercício' : 'Fora de exercício'}
        </Badge>
      </Link>
    </li>
  );
}
