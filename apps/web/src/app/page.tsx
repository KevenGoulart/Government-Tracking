import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function HomePage() {
  return (
    <section className="mx-auto max-w-3xl space-y-6 py-12 text-center">
      <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Raio-X Público</h1>
      <p className="text-muted-foreground text-lg">
        Veja como deputados federais usam a Cota para o Exercício da Atividade Parlamentar (CEAP),
        com dados abertos oficiais da Câmara dos Deputados.
      </p>
      <Button size="lg" asChild>
        <Link href="/parlamentares">Buscar parlamentares</Link>
      </Button>
    </section>
  );
}
