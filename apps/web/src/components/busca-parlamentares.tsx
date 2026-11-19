import type { FiltrosParlamentares, ParlamentaresQuery } from '@raio-x/shared';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CampoSelect } from './campo-select';

interface BuscaParlamentaresProps {
  filtros: FiltrosParlamentares;
  valores: Pick<ParlamentaresQuery, 'nome' | 'partido' | 'uf'>;
}

/**
 * Formulário GET: os filtros vão para a URL (links compartilháveis) e a busca funciona
 * mesmo sem JavaScript.
 */
export function BuscaParlamentares({ filtros, valores }: BuscaParlamentaresProps) {
  const temFiltro = Boolean(valores.nome || valores.partido || valores.uf);
  return (
    <form
      action="/parlamentares"
      method="get"
      role="search"
      aria-label="Buscar parlamentares"
      className="grid gap-4 sm:grid-cols-[1fr_10rem_8rem_auto] sm:items-end"
    >
      <div className="space-y-1.5">
        <label htmlFor="nome" className="text-sm font-medium">
          Nome
        </label>
        <Input
          id="nome"
          name="nome"
          type="search"
          placeholder="Ex.: Tabata Amaral"
          defaultValue={valores.nome}
          minLength={2}
          maxLength={100}
          autoComplete="off"
        />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="partido" className="text-sm font-medium">
          Partido
        </label>
        <CampoSelect id="partido" name="partido" defaultValue={valores.partido ?? ''}>
          <option value="">Todos</option>
          {filtros.partidos.map((partido) => (
            <option key={partido} value={partido}>
              {partido}
            </option>
          ))}
        </CampoSelect>
      </div>
      <div className="space-y-1.5">
        <label htmlFor="uf" className="text-sm font-medium">
          UF
        </label>
        <CampoSelect id="uf" name="uf" defaultValue={valores.uf ?? ''}>
          <option value="">Todas</option>
          {filtros.ufs.map((uf) => (
            <option key={uf} value={uf}>
              {uf}
            </option>
          ))}
        </CampoSelect>
      </div>
      <div className="flex gap-2">
        <Button type="submit">Buscar</Button>
        {temFiltro && (
          <Button variant="ghost" asChild>
            <Link href="/parlamentares">Limpar</Link>
          </Button>
        )}
      </div>
    </form>
  );
}
