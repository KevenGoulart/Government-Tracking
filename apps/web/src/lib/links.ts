/** Link canônico do fornecedor: pelo CNPJ/CPF quando existe, senão pelo id interno. */
export function hrefFornecedor(fornecedor: { id: string; documento: string | null }): string {
  return `/fornecedores/${fornecedor.documento ?? fornecedor.id}`;
}

export function hrefParlamentar(id: string): string {
  return `/parlamentares/${id}`;
}
