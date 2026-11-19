# Raio-X Público

Plataforma web para explorar os gastos públicos de parlamentares brasileiros a partir de **dados abertos oficiais**. Pesquise um deputado federal ou senador, veja como usa a cota parlamentar (CEAP na Câmara, CEAPS no Senado), quais emendas ao orçamento apresentou, compare com outros parlamentares e descubra quais fornecedores receberam dinheiro público.

> Apresentação neutra: o projeto mostra números e a fonte oficial, sem conclusões editoriais.

![Percurso pelo app: home, busca, página do parlamentar e ranking](docs/img/tour.gif)

| Página do parlamentar                              | Pontos de atenção (tema escuro)                                     | Celular                                      |
| -------------------------------------------------- | ------------------------------------------------------------------- | -------------------------------------------- |
| ![Página do parlamentar](docs/img/parlamentar.png) | ![Pontos de atenção no tema escuro](docs/img/pontos-de-atencao.png) | ![Versão para celular](docs/img/celular.png) |

Mais capturas: [home](docs/img/home.png) · [ranking](docs/img/ranking.png). As imagens são
geradas com dados reais por `pnpm --filter @raio-x/web capturas -- <id>`.

## Arquitetura

```mermaid
flowchart LR
  subgraph Fontes oficiais
    CAM[API Câmara<br/>deputados]
    COTA[Cota da Câmara<br/>CSV anual]
    SEN[API Senado<br/>senadores]
    CEAPS[CEAPS do Senado<br/>CSV anual]
    PT[Portal da Transparência<br/>emendas]
  end

  subgraph Backend
    WK[apps/worker<br/>NestJS + BullMQ]
    RD[(Redis<br/>filas e cache)]
    PG[(PostgreSQL)]
    API[apps/api<br/>NestJS REST + Swagger]
  end

  WEB[apps/web<br/>Next.js]

  CAM -- semanal --> WK
  COTA -- diária --> WK
  SEN -- semanal --> WK
  CEAPS -- diária --> WK
  PT -- semanal --> WK
  WK <--> RD
  WK -- upsert idempotente --> PG
  API --> PG
  API <--> RD
  WEB -- HTTP --> API
```

Em produção, o front fica na **Vercel** e API, worker, Postgres e Redis no **Render**, descritos
em um Blueprint versionado ([`render.yaml`](render.yaml)). Passo a passo em
[docs/deploy.md](docs/deploy.md).

O front-end **nunca** chama as APIs do governo diretamente: tudo passa por ingestão → Postgres → API própria. Assim os dados ficam normalizados, as consultas agregadas são rápidas e a disponibilidade não depende das fontes externas.

## Estrutura do monorepo

| Caminho                  | Descrição                                                       |
| ------------------------ | --------------------------------------------------------------- |
| `apps/web`               | Next.js (App Router), Tailwind, shadcn/ui, TanStack Query       |
| `apps/api`               | API REST em NestJS, validação com Zod, documentação em `/docs`  |
| `apps/worker`            | Ingestão de dados com BullMQ (jobs agendados e idempotentes)    |
| `packages/db`            | Schema Prisma, migrations e client compartilhado (API e worker) |
| `packages/shared`        | Schemas Zod, tipos e utilitários usados no front e no back      |
| `packages/tsconfig`      | Configurações TypeScript (strict) compartilhadas                |
| `packages/eslint-config` | Configurações ESLint compartilhadas (type-aware, sem `any`)     |

## Funcionalidades

| Página                      | O que mostra                                                                                                                                   |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`                         | Totais do ano por casa (Câmara ou Senado): categorias, maiores totais e gastos por estado (total e média por parlamentar)                      |
| `/parlamentares`            | Busca por nome (tolera erros de digitação), casa, partido e UF                                                                                 |
| `/parlamentares/[id]`       | Evolução mensal, categorias, maiores fornecedores, pontos de atenção, despesas (com link para a nota fiscal, quando a fonte publica) e emendas |
| `/ranking`                  | Total por parlamentar no ano, por casa, com filtros de categoria, partido e UF                                                                 |
| `/fornecedores/[documento]` | Quanto o fornecedor recebeu e de quais parlamentares                                                                                           |
| `/comparar`                 | 2 a 4 parlamentares da mesma casa lado a lado: totais, evolução mensal e categorias                                                            |

Todas as páginas mostram a fonte oficial e a data da última sincronização, funcionam em
tema claro e escuro, no celular, e são verificadas com axe-core nos testes e2e.

### API

| Endpoint                                   | Descrição                                                          |
| ------------------------------------------ | ------------------------------------------------------------------ |
| `GET /parlamentares`                       | Lista com busca e filtros, paginada                                |
| `GET /parlamentares/:id`                   | Dados e resumo de gastos                                           |
| `GET /parlamentares/:id/despesas`          | Despesas com filtros de ano, mês e categoria                       |
| `GET /parlamentares/:id/gastos-mensais`    | Série mensal                                                       |
| `GET /rankings`                            | Total por parlamentar (casa, ano, categoria, partido, UF)          |
| `GET /estatisticas`                        | Totais gerais da casa, por categoria e por estado                  |
| `GET /parlamentares/:id/emendas`           | Emendas do parlamentar: totais, por área e localidade, lista       |
| `GET /parlamentares/:id/pontos-de-atencao` | Despesas atípicas para a categoria e concentração em um fornecedor |
| `GET /categorias?casa=`                    | Categorias de despesa de cada casa                                 |
| `GET /fornecedores/:documento`             | Fornecedor e parlamentares que o pagaram                           |
| `GET /comparacao?ids=a,b`                  | Comparação de 2 a 4 parlamentares                                  |
| `GET /meta/sync`                           | Última sincronização de cada fonte                                 |

Documentação interativa em `/docs` (Swagger). Os endpoints agregados usam cache em Redis.

## Como rodar localmente

Pré-requisitos: Node.js 24 (ver `.nvmrc`), pnpm 11 e Docker.

```bash
# 1. Variáveis de ambiente
cp .env.example .env

# 2. Postgres e Redis
docker compose up -d

# 3. Dependências e banco
pnpm install
pnpm db:deploy        # aplica as migrations

# 4. Carga inicial dos anos em SYNC_INITIAL_YEARS: Câmara (~7 min), Senado (~2 min) e,
#    com TRANSPARENCIA_API_KEY no .env, emendas (~7 min por ano)
pnpm sync:initial

# 5. Subir web (3000), API (3001) e worker em modo dev
pnpm dev
```

- Front-end: http://localhost:3000
- API: http://localhost:3001 · health check em `/health` · Swagger em `/docs`

## Scripts

| Comando                                      | O que faz                                                                          |
| -------------------------------------------- | ---------------------------------------------------------------------------------- |
| `pnpm dev`                                   | Sobe todos os apps em modo desenvolvimento                                         |
| `pnpm build`                                 | Build de todos os pacotes e apps                                                   |
| `pnpm lint`                                  | ESLint em todo o monorepo                                                          |
| `pnpm typecheck`                             | Checagem de tipos                                                                  |
| `pnpm test`                                  | Testes unitários (Vitest)                                                          |
| `pnpm test:e2e`                              | e2e da API (Supertest), integração do worker (Postgres) e front (Playwright + axe) |
| `pnpm sync:initial`                          | Carga inicial: Câmara, Senado e emendas                                            |
| `pnpm db:migrate`                            | Cria/aplica migrations em desenvolvimento                                          |
| `pnpm format`                                | Formata o código com Prettier                                                      |
| `pnpm --filter @raio-x/web capturas -- <id>` | Gera as imagens do README (docs/img) com o app rodando                             |

## Pontos de atenção

Indicadores estatísticos simples, sem juízo de valor, exibidos na página do parlamentar com a
regra explicada:

- **Despesa atípica**: acima do percentil 99 **e** de Q3 + 3×IQR das despesas da mesma
  categoria no ano (todos os parlamentares da casa).
- **Concentração**: um fornecedor com CNPJ/CPF recebeu 50% ou mais do total do ano, sem contar
  passagens, a partir de R$ 50 mil.

Os limiares foram calibrados com os dados reais; o porquê de cada um está em
[docs/decisoes.md](docs/decisoes.md#pontos-de-atenção-fase-4).

## Deploy

| Parte                         | Onde               | Arquivo                                       |
| ----------------------------- | ------------------ | --------------------------------------------- |
| Front-end                     | Vercel             | `apps/web/vercel.json`                        |
| API, worker, Postgres e Redis | Render (Blueprint) | `render.yaml`, `apps/{api,worker}/Dockerfile` |

- As migrations rodam no `preDeployCommand` da API, antes de a versão nova receber tráfego.
- Com o banco vazio, o worker enfileira a carga inicial sozinho: o primeiro deploy não exige
  acesso a um shell.
- O worker roda em 512 MB: a sincronização da Câmara caiu de 1,4 GB para ~420 MB de pico
  (streaming por deputado e lotes pequenos no Prisma; detalhes em
  [docs/decisoes.md](docs/decisoes.md#memória-do-worker)).
- O CI constrói as duas imagens Docker a cada push.

## Decisões técnicas

As decisões não óbvias estão registradas, com o motivo de cada uma, em [docs/decisoes.md](docs/decisoes.md). Destaques:

- **Despesas vêm do arquivo anual oficial da Cota (CSV), não da API**: a API devolve `valorLiquido` com o sinal invertido e exigiria ~2.100 requisições por ano.
- **Chave das despesas derivada do conteúdo**: a fonte não tem ID único por linha; reprocessar não duplica nada e o banco espelha a fonte.

- **Monorepo com Turborepo + pnpm**: tipos e schemas compartilhados entre front e back sem publicar pacotes; o Turbo cuida da ordem de build e do cache.
- **Worker separado da API**: a ingestão tem perfil de carga diferente (jobs longos, rate limit) e escala/faz deploy de forma independente.
- **Prisma 7 com driver adapter (`@prisma/adapter-pg`)** em um pacote próprio (`packages/db`), para que API e worker usem o mesmo schema e client.
- **Zod como fonte única de validação**: os mesmos schemas validam a entrada na API (via um `ZodValidationPipe` próprio) e tipam o front-end. O pacote `nestjs-zod` ainda não suporta NestJS 12, e o pipe próprio tem poucas linhas.
- **Valores monetários em `Decimal(12,2)`**, nunca `float`.
- **Busca de nomes com `pg_trgm`** (índice GIN sobre uma coluna normalizada sem acentos), tolerante a erros de digitação.
- **Chaves naturais em todos os upserts** (`idExterno`, documento do fornecedor, slug da categoria): rodar a ingestão duas vezes não duplica dados.
- **Vitest em todo o monorepo** (com SWC no NestJS para preservar os metadados de decorators); acessibilidade verificada com axe-core nos testes e2e do front.
- **Versões fixadas por compatibilidade**: TypeScript 6.0 (o typescript-eslint ainda não suporta o TS 7) e Prisma 7.10 (a tag `latest` aponta para um RC da v8).

## Fontes de dados

| Fonte                                                                                                                                                      | Uso                       | Fase |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- | ---- |
| [Dados Abertos da Câmara](https://dadosabertos.camara.leg.br/swagger/api.html)                                                                             | Deputados                 | 1    |
| [Cota Parlamentar — arquivos anuais](https://www2.camara.leg.br/transparencia/cota-para-exercicio-da-atividade-parlamentar/dados-abertos-cota-parlamentar) | Despesas (CEAP)           | 1    |
| [Dados Abertos do Senado](https://legis.senado.leg.br/dadosabertos) e CSV anual da CEAPS                                                                   | Senadores e despesas      | 3    |
| [Portal da Transparência (CGU)](https://api.portaldatransparencia.gov.br) (chave gratuita)                                                                 | Emendas parlamentares     | 3    |
| Dados Abertos do TSE                                                                                                                                       | Bens e contas de campanha | —    |

## Roadmap

- [x] **Fase 0**: monorepo, Docker Compose, Prisma, lint/format, CI
- [x] **Fase 1**: ingestão da Câmara, API de parlamentares/despesas, busca e página do parlamentar
- [x] **Fase 2**: rankings, fornecedores, comparação, estatísticas, cache
- [x] **Fase 3**: Senado e emendas parlamentares
- [x] **Fase 4**: pontos de atenção (detecção simples de valores fora do padrão)
- [x] **Fase 5**: deploy (Dockerfiles, Blueprint do Render, Vercel), worker em 512 MB e README final

Próximos passos possíveis: bens declarados e contas de campanha (TSE), que ficaram fora do
escopo das fases.
