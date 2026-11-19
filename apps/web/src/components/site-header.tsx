import Link from 'next/link';
import { ThemeToggle } from './theme-toggle';

export function SiteHeader() {
  return (
    <header className="border-b">
      <div className="container mx-auto flex h-14 items-center justify-between gap-4 px-4">
        <div className="flex items-center gap-6">
          <Link href="/" className="font-semibold tracking-tight">
            Raio-X Público
          </Link>
          <nav aria-label="Principal">
            <Link
              href="/parlamentares"
              className="text-muted-foreground hover:text-foreground text-sm font-medium"
            >
              Parlamentares
            </Link>
          </nav>
        </div>
        <ThemeToggle />
      </div>
    </header>
  );
}
