import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

/** `<select>` nativo com o visual dos inputs do shadcn: funciona sem JavaScript e é acessível. */
export function CampoSelect({ className, ...props }: ComponentProps<'select'>) {
  return (
    <select
      className={cn(
        'border-input dark:bg-input/30 focus-visible:border-ring focus-visible:ring-ring/50 h-8 w-full rounded-lg border bg-transparent px-2.5 text-base outline-none focus-visible:ring-3 md:text-sm',
        className,
      )}
      {...props}
    />
  );
}
