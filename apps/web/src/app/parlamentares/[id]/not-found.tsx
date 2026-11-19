import Link from 'next/link';

export default function ParlamentarNaoEncontrado() {
  return (
    <div className="mx-auto max-w-md space-y-4 py-16 text-center">
      <h1 className="text-2xl font-bold">Parlamentar não encontrado</h1>
      <p className="text-muted-foreground">O link pode estar incorreto ou desatualizado.</p>
      <Link href="/parlamentares" className="text-primary underline underline-offset-4">
        Voltar para a busca
      </Link>
    </div>
  );
}
