import Link from 'next/link';

export default function FornecedorNaoEncontrado() {
  return (
    <div className="mx-auto max-w-md space-y-4 py-16 text-center">
      <h1 className="text-2xl font-bold">Fornecedor não encontrado</h1>
      <p className="text-muted-foreground">
        Confira o CNPJ/CPF. Só aparecem fornecedores que receberam pagamentos da cota parlamentar
        nos anos sincronizados.
      </p>
      <Link href="/" className="text-primary underline underline-offset-4">
        Voltar para o início
      </Link>
    </div>
  );
}
