import Image from 'next/image';
import { cn } from '@/lib/utils';

interface FotoParlamentarProps {
  nome: string;
  fotoUrl: string | null;
  tamanho: number;
  className?: string;
  prioridade?: boolean;
}

function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/);
  return (
    (partes[0]?.[0] ?? '') + (partes.length > 1 ? (partes.at(-1)?.[0] ?? '') : '')
  ).toUpperCase();
}

export function FotoParlamentar({
  nome,
  fotoUrl,
  tamanho,
  className,
  prioridade,
}: FotoParlamentarProps) {
  const estilo = cn('bg-muted shrink-0 rounded-full object-cover', className);
  if (!fotoUrl) {
    return (
      <span
        aria-hidden
        className={cn(estilo, 'text-foreground flex items-center justify-center font-medium')}
        style={{ width: tamanho, height: tamanho }}
      >
        {iniciais(nome)}
      </span>
    );
  }
  return (
    <Image
      src={fotoUrl}
      alt={`Foto oficial de ${nome}`}
      width={tamanho}
      height={tamanho}
      className={estilo}
      style={{ width: tamanho, height: tamanho }}
      priority={prioridade}
    />
  );
}
