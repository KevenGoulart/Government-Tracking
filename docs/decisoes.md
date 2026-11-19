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
| Senadores                       | segunda, 04:30            | Idem deputados                                                    |
| Despesas do Senado (CEAPS)      | diariamente, 07:30        | O CSV é atualizado por volta das 02:00                            |
| Emendas (ano atual e anterior)  | domingo, 02:00            | Mudam devagar; ~7 min por ano a 1 req/s, de madrugada             |

A fila tem concorrência 1, então as sincronizações nunca rodam ao mesmo tempo. Sem
`TRANSPARENCIA_API_KEY`, o agendamento de emendas é removido e o resto funciona. Para carga
inicial ou depuração existe a CLI (`pnpm sync:initial`,
`pnpm --filter @raio-x/worker sync despesas 2024`, `... sync emendas 2025`), que não passa
pela fila.

## Senado: CSV da CEAPS e vínculo pelo nome

O CSV anual da CEAPS (`despesa_ceaps_AAAA.csv`) é ISO-8859-1, separado por `;`, tem uma
linha de metadados antes do cabeçalho, valores no formato brasileiro (inclusive `",03"`,
sem zero à esquerda) e datas `dd/mm/aaaa`. `COD_DOCUMENTO` é único no arquivo de cada ano
(verificado em 2025 e 2026), então a chave é `senado:<ano>:<COD_DOCUMENTO>`.

Diferenças em relação à Câmara, todas visíveis na interface:

- **Só existe o valor reembolsado**: sem valor do documento nem glosa.
- **Sem link para o comprovante.**
- **O senador vem só pelo nome**, sem identificador. O vínculo usa o `IndiceNomes`
  (`apps/worker/src/comum/indice-nomes.ts`): nome parlamentar idêntico e único; senão,
  todas as palavras do nome da fonte em ordem no nome civil, com a mesma primeira palavra
  ("WEVERTON ROCHA" → "Weverton", nome civil "Weverton Rocha Marques de Sousa"). Homônimos
  (há dois "Fernando Carvalho", ambos de SE) **nunca são resolvidos no chute**: as linhas
  ficam sem vínculo e são listadas em `SyncRun.detalhes.semVinculo`. Em 2025 e 2026 todas
  as linhas foram vinculadas.
- **Categorias próprias**: as cotas têm regras diferentes, então as categorias do Senado
  têm `casa = SENADO` e slug com prefixo `senado-`, mesmo quando o nome se parece com uma
  da Câmara ("Divulgação da atividade parlamentar" existe nas duas).

**Só entra como senador quem exerceu o mandato.** A lista da legislatura traz titulares e
suplentes, inclusive os que nunca assumiram (só 107 dos 245 nomes da legislatura 57
exerceram). Vários desses suplentes são **deputados federais** (ex.: Rodolfo Nogueira,
Fabio Garcia, Eduardo Velloso, Waldemar Oliveira): importá-los criava a mesma pessoa duas
vezes, uma em cada casa, e deixava ambíguo o autor de centenas de emendas. Agora só entram
os que têm um exercício (`Mandato.Exercicios`) dentro do período da legislatura, além dos em
exercício hoje; quem sai da lista e não tem despesas é removido.

**Câmara e Senado nunca são somados.** Ranking e estatísticas recebem `casa` (padrão
Câmara) e a comparação recusa parlamentares de casas diferentes. Fornecedores, por outro
lado, são compartilhados: o mesmo CNPJ que recebeu de deputados e senadores tem uma página só.

## Emendas parlamentares (Portal da Transparência)

- **15 itens por página**, sem opção de aumentar: ~420 páginas por ano. Com 1 req/s
  (`TRANSPARENCIA_RATE_LIMIT_PER_SECOND`), ~7 minutos por ano.
- **Valores acumulados que mudam com o tempo** (empenhado → liquidado → pago). Como a fonte
  é consultada inteira, cada sincronização substitui o ano numa transação. Uma resposta
  vazia interrompe a sincronização em vez de apagar o ano.
- **Autor só pelo nome**, sem casa nem identificador. O vínculo usa o mesmo `IndiceNomes`,
  sobre deputados e senadores juntos; um nome que exista nas duas casas para pessoas
  diferentes (ex.: dois "Bebeto", um deputado do RJ e um senador da BA) fica sem vínculo.
  O que sobra sem vínculo são apelidos que não aparecem no nome civil (ex.: "YURY DO
  PAREDAO", cadastrado na Câmara como "Yury Bruno") e substitutos que não estão na base.

  | Ano  | Emendas | Bancada/comissão | Vinculadas      | Sem vínculo |
  | ---- | ------- | ---------------- | --------------- | ----------- |
  | 2025 | 6.310   | 239              | 6.056 (99,75%¹) | 15          |
  | 2026 | 5.955   | 159              | 5.793 (99,95%¹) | 3           |

  ¹ Entre as emendas com uma pessoa como autor. Os vínculos feitos pela regra do nome civil
  foram conferidos um a um (ex.: "DR. FLAVIO" → Dr Flávio, RJ, substituto de Delegado
  Ramagem; "RAFAEL BENTO" → Rafael Fera, RO, sucessor de Lebrão).

- **Autores coletivos** (emendas de bancada e comissão) ficam sem vínculo de propósito.
- **Sucessão de mandato**: autores como "RODRIGO DA ZAELI (EX-PARLAMENTAR ABILIO BRUNINI,
  NOS TERMOS ART. 78 LDO 2025...)" mostram que a emenda passou para o sucessor. O vínculo é
  com quem aparece como autor; o texto entre parênteses é guardado e exibido.
- **Fotos do Senado**: a API informa `http://www.senado.leg.br/.../senador{codigo}.jpg`, que
  redireciona; gravamos o destino final em HTTPS (`legis.senado.leg.br`).

## Pontos de atenção (Fase 4)

Duas regras estatísticas simples, calculadas na API sobre os dados já sincronizados e
explicadas na própria página. A redação é neutra: os pontos **não indicam irregularidade**.
Os números ficam em `CRITERIOS_PONTOS_ATENCAO` (`packages/shared`), usados tanto no cálculo
quanto no texto exibido, para que a explicação nunca fique diferente da regra.

**1. Despesa atípica para a categoria.** O valor precisa estar acima do **percentil 99** e da
**cerca de Tukey para valores extremos** (Q3 + 3 × IQR) das despesas da mesma categoria, no
mesmo ano, considerando todos os parlamentares da casa. As duas condições juntas foram
escolhidas olhando os dados de 2025 (Câmara):

| Categoria (2025)    | Só cerca de Tukey | Só P99 | Por quê                                                  |
| ------------------- | ----------------- | ------ | -------------------------------------------------------- |
| Combustíveis        | 2.147 despesas    | 712    | Distribuição muito assimétrica: a cerca (R$ 684) é baixa |
| Locação de veículos | 0                 | 71     | Valores quase fixos: o P99 marca contratos comuns        |
| Passagens (SIGEPA)  | 7                 | 299    | Idem                                                     |

Com as duas condições, só sobra o que é extremo pelas duas medidas. Estornos (valores
negativos) não entram no padrão, e categorias com menos de 50 despesas no ano são ignoradas.
A lista mostra as 10 despesas mais distantes da mediana, com a mediana ao lado.

**2. Concentração em um fornecedor.** Um único fornecedor com CNPJ/CPF recebeu **50% ou mais**
do total do ano, a partir de R$ 50 mil. Três ajustes vieram dos dados:

- **Passagens ficam fora**: são compradas pelos sistemas das casas e se concentram
  naturalmente em poucas companhias. Com elas, TAM e a agência de viagens apareciam como o
  maior fornecedor de dezenas de deputados.
- **Fornecedores sem documento ficam fora**: "RAMAL" (telefonia, sem CNPJ válido) juntaria
  empresas diferentes sob o mesmo nome.
- **Limiar de 50%**: com 30%, metade dos deputados seria destacada (aluguel de veículo e de
  escritório pesam naturalmente); com 50%, ~10% (68 de 562 em 2025).

**Alternativa descartada: fornecedor exclusivo** (que só recebe de um parlamentar). Em 2025,
476 deputados teriam ao menos um fornecedor exclusivo acima de R$ 50 mil. São, em geral,
prestadores locais contratados por um único gabinete (divulgação, escritório, locação de
veículos, nessa ordem): a regra destacaria o normal.

**Cálculo na API, não no worker.** O padrão de cada categoria (quartis e P99 de ~200 mil
linhas) leva ~270 ms no Postgres e fica em cache por casa e ano; a resposta do parlamentar
também. Calcular na hora mantém tudo coerente com os dados sem uma tabela derivada a mais
para manter. Primeira chamada: ~1,5 s; com cache: ~40 ms.

## Front-end: renderização por requisição com cache de dados

O rodapé mostra a data da última sincronização em todas as páginas. Se fosse
pré-renderizada no build, a data ficaria congelada (ou ausente, se a API não estivesse
acessível no build). Por isso o componente usa `connection()` e todas as rotas são
renderizadas por requisição. As respostas da API ficam em cache (`next.revalidate`: 1 h
para dados, 5 min para o status de sincronização), então o custo extra é pequeno.

Os filtros usam formulários GET comuns: funcionam sem JavaScript, ficam na URL (links
compartilháveis) e o botão voltar do navegador funciona naturalmente. A comparação segue
a mesma ideia: adicionar ou remover um parlamentar é um link que altera `?ids=`.

## Cache: duas camadas, ambas versionadas

| Camada                                                                     | Onde                      | TTL                       | Chave inclui                                                |
| -------------------------------------------------------------------------- | ------------------------- | ------------------------- | ----------------------------------------------------------- |
| Respostas agregadas da API (ranking, estatísticas, fornecedor, comparação) | Redis                     | 1 h                       | versão do código + fim da última sincronização + parâmetros |
| Respostas da API no front                                                  | Cache de dados do Next.js | 1 h (5 min para o status) | cabeçalho `X-App-Version` + URL                             |

- **Invalidação por versão, não por comando.** A chave do Redis inclui o fim da última
  sincronização bem-sucedida: quando o worker termina, a API passa a usar chaves novas e
  as antigas expiram sozinhas. Nenhum processo precisa avisar o outro.
- **A versão do código entra nas duas chaves.** Isso foi descoberto na prática: ao incluir
  um campo novo na resposta de `/fornecedores`, tanto o Redis quanto o cache do Next
  continuaram servindo o formato antigo, e a validação Zod do front quebrou. Agora cada
  deploy (`APP_VERSION`/`VERCEL_GIT_COMMIT_SHA`) usa chaves próprias. Sem versão definida,
  a API usa o horário de início do processo.
- **Rede de segurança no front.** Se uma resposta do cache não passar no schema, o front
  busca de novo direto na API antes de tratar como erro de contrato.
- **Falha do Redis não derruba a API**: as respostas são calculadas direto do banco.

Com os dados reais, `/estatisticas` cai de ~410 ms para ~25 ms e `/fornecedores/:documento`
de ~110 ms para ~5 ms com o cache.

## Ranking: partido e UF atuais, total sem juízo de valor

Os filtros de partido e UF do ranking usam os dados **atuais** do parlamentar. Quem trocou
de partido aparece no partido novo também para despesas antigas. Isso está escrito na
própria página. O texto também lembra que o limite da cota varia por estado (passagens
mais caras para estados distantes de Brasília): um total alto não indica irregularidade.

Nos gastos por estado, a página mostra o total e a **média por deputado**, já que as
bancadas têm tamanhos muito diferentes (SP tem 70 vagas; vários estados têm 8).

## Fornecedor: por CNPJ/CPF ou por id

`GET /fornecedores/:documento` aceita CNPJ/CPF com ou sem pontuação. Fornecedores sem
documento válido na fonte (identificados pelo nome, ver acima) não teriam como ser
acessados; para eles a mesma rota aceita o id interno. O front sempre gera o link
canônico: documento quando existe, id caso contrário.

## Gráficos

- Série única usa um só tom de azul; a comparação usa a paleta categórica em ordem fixa
  (azul, laranja, verde-água, amarelo), validada para daltonismo nos dois temas.
- No tema claro, verde-água e amarelo ficam abaixo de 3:1 de contraste contra o fundo;
  por isso a comparação sempre exibe uma tabela visível com os valores, além da legenda.
- Todo gráfico tem uma tabela equivalente para leitores de tela, e o próprio gráfico fica
  fora da árvore de acessibilidade (`aria-hidden`, sem foco).
- Em anos em andamento os meses recentes parecem "cair", porque os reembolsos são lançados
  com atraso; os gráficos avisam isso para não sugerir uma redução que não houve.

## Versões fixadas

- **TypeScript 6.0**: o typescript-eslint ainda não suporta o TypeScript 7.
- **Prisma 7.10**: a tag `latest` do npm aponta para uma versão RC da 8.
- **NestJS 12 sem `nestjs-zod`**: o pacote não suporta Nest 12; um `ZodValidationPipe`
  próprio (~20 linhas) e `z.toJSONSchema` cobrem validação e Swagger.
- **ESLint 10 sem `eslint-plugin-jsx-a11y`**: o plugin não suporta ESLint 10. A
  acessibilidade é verificada com axe-core nos testes Playwright, sobre a página renderizada.

## Memória do worker

Medido na sincronização da cota da Câmara de 2025 (208 mil linhas, CSV de 75 MB descompactado):

| Versão                                         | Pico de RSS | Heap necessário |
| ---------------------------------------------- | ----------- | --------------- |
| Fase 1: ano inteiro em memória, lotes de 5.000 | 1,4 GB      | mais de 320 MB  |
| Fase 5: streaming por deputado, lotes de 200   | ~420 MB     | cabe em 192 MB  |

Duas causas, encontradas medindo cada etapa:

1. **Todas as despesas do ano em memória** antes de gravar (~200 MB de heap). Agora são duas
   passadas sobre o CSV: a primeira valida o arquivo e coleta categorias, fornecedores e
   deputados (~20 MB); a segunda grava um deputado por vez. O arquivo oficial vem agrupado
   por deputado (563 blocos para 563 deputados em 2025; 566/566 em 2026). Se um dia vier fora
   de ordem, a primeira passada detecta e o worker volta a agrupar em memória, com um aviso:
   processar em sequência um arquivo desordenado apagaria despesas válidas. Nada é gravado
   antes de o arquivo inteiro ser validado. O CSV é lido em pedaços de 1 MB que apontam para o
   mesmo buffer, sem as cópias de 75 MB de antes.
2. **O Prisma 7 guarda em cache o plano de cada consulta**, e o plano de um `createMany`
   cresce com o número de linhas. Depois de inserir os fornecedores em lotes de 5.000, ~120 MB
   ficavam retidos mesmo após o GC. Com lotes de 200, de tamanho fixo, o tamanho e a quantidade
   de planos diferentes ficam limitados. O custo é tempo: a sincronização (sem mudanças a gravar)
   foi de 1min39 para 2min17, com o heap limitado a 192 MB.

A imagem do worker define `--max-old-space-size=256`. Sem limite, o V8 adia a coleta e o RSS
sobe à toa; com ele, o worker roda numa instância de 512 MB (testado num container com
`--memory=512m`, fazendo a carga inicial do zero).

## Deploy

Passo a passo em [deploy.md](deploy.md). Decisões:

- **Render para API, worker, Postgres e Redis, num Blueprint (`render.yaml`)**: toda a infra do
  back-end versionada num arquivo, com banco e Redis ligados aos serviços por referência (sem
  copiar URLs). Railway e Fly exigiriam um arquivo por serviço e criar banco e Redis à mão.
- **Vercel para o front**, como no plano. O front só chama a API pelo servidor, então não há
  CORS a configurar para ele.
- **Migrations no `preDeployCommand` da API**: rodam uma vez por deploy, antes de a versão nova
  receber tráfego; se falharem, a anterior continua no ar. O Prisma CLI virou dependência de
  produção do pacote db: ele já vinha na imagem como peer dependency do `@prisma/client`, e
  uma etapa separada só para as migrations somava 256 MB à imagem.
- **Carga inicial automática**: com o banco vazio, o worker enfileira a carga dos anos em
  `SYNC_INITIAL_YEARS` (ids de job fixos evitam duplicar se reiniciar). Assim o primeiro
  deploy não depende de acesso a um shell no servidor, que no Render é pago.
- **Imagens a partir do monorepo recortado** (`turbo prune`): o `pnpm deploy` padrão exige
  `inject-workspace-packages`, que mudaria o fluxo de desenvolvimento, e o modo legado deixa
  links para fora da imagem. A imagem reinstala só as dependências de produção sobre a árvore
  recortada, onde os links do pnpm são relativos. Tamanho: ~720 MB cada, a maior parte do
  Prisma (CLI e Studio vêm juntos como peer dependency).
- **`PORT` e commit da plataforma**: a API aceita `PORT` e usa `RENDER_GIT_COMMIT` como versão
  do código quando `API_PORT`/`APP_VERSION` não estão definidas.
