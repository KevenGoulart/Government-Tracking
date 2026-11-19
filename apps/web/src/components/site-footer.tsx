export function SiteFooter() {
  return (
    <footer className="text-muted-foreground border-t text-sm">
      <div className="container mx-auto px-4 py-6">
        Fonte:{' '}
        <a
          href="https://dadosabertos.camara.leg.br"
          className="hover:text-foreground underline underline-offset-4"
          target="_blank"
          rel="noreferrer"
        >
          Dados Abertos da Câmara dos Deputados
        </a>
        .
      </div>
    </footer>
  );
}
