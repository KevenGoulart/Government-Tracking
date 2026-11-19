'use client';

import { Button } from '@/components/ui/button';

export default function Erro({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-md space-y-4 py-16 text-center" role="alert">
      <h1 className="text-2xl font-bold">Não foi possível carregar os dados</h1>
      <p className="text-muted-foreground">
        O serviço pode estar temporariamente indisponível. Tente novamente em instantes.
      </p>
      <Button onClick={reset}>Tentar novamente</Button>
    </div>
  );
}
