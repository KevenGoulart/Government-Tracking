import { Skeleton } from '@/components/ui/skeleton';

export default function Carregando() {
  return (
    <div className="space-y-8" aria-busy="true" aria-label="Carregando">
      <div className="space-y-2">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-5 w-96 max-w-full" />
      </div>
      <Skeleton className="h-14 w-full" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 9 }, (_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
    </div>
  );
}
