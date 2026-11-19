import Link from 'next/link';
import { ThemeToggle } from './theme-toggle';

const LINKS = [
  { href: '/parlamentares', rotulo: 'Parlamentares' },
  { href: '/ranking', rotulo: 'Ranking' },
  { href: '/comparar', rotulo: 'Comparar' },
] as const;

export function SiteHeader() {
  return (
    <header className="border-b">
      <div className="container mx-auto flex h-14 items-center justify-between gap-4 px-4">
        <div className="flex min-w-0 items-center gap-4 sm:gap-6">
          <Link href="/" className="shrink-0 font-semibold tracking-tight">
            Raio-X Público
          </Link>
          <nav aria-label="Principal" className="flex items-center gap-3 overflow-x-auto sm:gap-4">
            {LINKS.map(({ href, rotulo }) => (
              <Link
                key={href}
                href={href}
                className="text-muted-foreground hover:text-foreground text-sm font-medium"
              >
                {rotulo}
              </Link>
            ))}
          </nav>
        </div>
        <ThemeToggle />
      </div>
    </header>
  );
}
