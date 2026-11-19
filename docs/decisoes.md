# Decisões técnicas

Registro das decisões que não são óbvias pelo código, com o motivo de cada uma.

## Fonte das despesas: arquivo anual da Cota Parlamentar (CSV), não a API

**Contexto.** O plano inicial era buscar as despesas pela API de Dados Abertos
(`/deputados/{id}/despesas`). Ao analisar os dados reais (novembro de 2026), apareceram dois problemas:

1. **A API inverte o sinal de `valorLiquido`.** Em ~80% das despesas comuns, `valorLiquido`
   vem negativo. Exemplo: o documento `7855758` tem `valorDocumento: 190.34` e
   `valorLiquido: -190.34` na API, e `vlrLiquido: 190.34` no arquivo oficial. O padrão
   aparece em 2023, 2024, 2025 e 2026.
2. **Custo:** o ano de 2025 tem 209 mil linhas, o que dá ~2.100 requisições paginadas
   (cerca de 12 minutos a 3 req/s). O arquivo anual é um único download de ~7 MB compactado.

**Decisão.** As despesas vêm de `https://www.camara.leg.br/cotas/Ano-AAAA.csv.zip`
(mesmo portal oficial, regerado diariamente). Os deputados continuam vindo da API, que
traz foto, situação e nome civil.

**Consequências.** O CSV traz campos que a API não tem (passageiro e trecho de
passagens aéreas). Ele também inclui despesas de **lideranças partidárias**, sem
deputado associado: elas são ignoradas e contadas em `SyncRun.detalhes.ignoradas`.

## Chave natural das despesas derivada do conteúdo

**Contexto.** Não existe identificador único por linha na fonte. `codDocumento`/`ideDocumento`
se repete: telefonia usa código `"0"`, e uma passagem emitida e depois cancelada aparece
duas vezes com o mesmo código (+X e −X). Combinações de colunas ainda colidiam em ~800
casos por ano.

**Decisão.** `idExterno = camara:<idDeputado>:<ano>:<sha256(conteúdo)[0:20]>:<ocorrência>`.
O contador de ocorrência diferencia linhas 100% idênticas. Cada sincronização processa
o ano inteiro de cada deputado: insere as chaves novas e apaga as que sumiram da fonte.

**Consequências.** Reprocessar o mesmo arquivo não altera nada (testado com dados reais:
126.370 despesas de 2026, 0 inserções e 0 remoções na segunda execução). Se a Câmara
corrige uma linha, ela é substituída (remove a antiga, insere a nova). Por segurança,
um arquivo sem despesas de deputados interrompe a sincronização em vez de apagar o ano.

## Documentos de fornecedor fictícios viram nulos

A fonte usa CNPJs fictícios como `00000000000006` (fornecedor "RAMAL", de telefonia):
4.494 linhas em 2025. CNPJ e CPF são validados pelos dígitos verificadores; documento
inválido vira `null` e o fornecedor passa a ser identificado pelo nome normalizado
(`Fornecedor.chave = "nome:<NOME>"`).

## Valor exibido: valor líquido, com estornos negativos

Os totais somam `valorLiquido` (valor do documento menos glosa), como no CSV oficial.
Estornos (ex.: passagem cancelada) têm valor negativo e abatem o total. Os filtros por
mês usam o **mês de competência** (`numMes`), que pode diferir da data do documento:
uma nota de 28/01/2026 pode ser lançada na competência dez/2025.

## Agendamento

| Job                             | Quando                    | Por quê                                                           |
| ------------------------------- | ------------------------- | ----------------------------------------------------------------- |
| Deputados                       | segunda, 04:00 (Brasília) | Muda pouco: posses, licenças, trocas de partido                   |
| Despesas (ano atual e anterior) | diariamente, 07:00        | O arquivo é regerado de madrugada; reembolsos chegam meses depois |

A fila tem concorrência 1, então deputados e despesas nunca rodam ao mesmo tempo. Para
carga inicial ou depuração existe a CLI (`pnpm sync:initial`,
`pnpm --filter @raio-x/worker sync despesas 2024`), que não passa pela fila.

## Front-end: renderização por requisição com cache de dados

O rodapé mostra a data da última sincronização em todas as páginas. Se fosse
pré-renderizada no build, a data ficaria congelada (ou ausente, se a API não estivesse
acessível no build). Por isso o componente usa `connection()` e todas as rotas são
renderizadas por requisição. As respostas da API ficam em cache (`next.revalidate`: 1 h
para dados, 5 min para o status de sincronização), então o custo extra é pequeno.

Os filtros usam formulários GET comuns: funcionam sem JavaScript, ficam na URL (links
compartilháveis) e o botão voltar do navegador funciona naturalmente.

## Versões fixadas

- **TypeScript 6.0**: o typescript-eslint ainda não suporta o TypeScript 7.
- **Prisma 7.10**: a tag `latest` do npm aponta para uma versão RC da 8.
- **NestJS 12 sem `nestjs-zod`**: o pacote não suporta Nest 12; um `ZodValidationPipe`
  próprio (~20 linhas) e `z.toJSONSchema` cobrem validação e Swagger.
- **ESLint 10 sem `eslint-plugin-jsx-a11y`**: o plugin não suporta ESLint 10. A
  acessibilidade é verificada com axe-core nos testes Playwright, sobre a página renderizada.

## Memória do worker

Processar um ano inteiro mantém o CSV descompactado (~75 MB) e as despesas mapeadas em
memória: pico de ~700 MB de RSS. É aceitável localmente; no deploy (Fase 5) pode ser
preciso processar o arquivo em streaming, agrupando por deputado.
