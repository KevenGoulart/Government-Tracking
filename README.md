# Raio-X Público

Plataforma web para explorar os gastos públicos de parlamentares brasileiros a partir de **dados abertos oficiais**. Pesquise um deputado federal, veja como ele usa a Cota para o Exercício da Atividade Parlamentar (CEAP), compare com outros parlamentares e descubra quais fornecedores receberam dinheiro público.

> Apresentação neutra: o projeto mostra números e a fonte oficial, sem conclusões editoriais.

**Status:** Fase 0 (setup) concluída · Fase 1 (MVP com dados da Câmara) em andamento.

## Arquitetura

```mermaid
flowchart LR
  subgraph Fontes oficiais
    CAM[API Dados Abertos<br/>Câmara dos Deputados]
  end

  subgraph Backend
    WK[apps/worker<br/>NestJS + BullMQ]
    RD[(Redis<br/>filas e cache)]
    PG[(PostgreSQL)]
    API[apps/api<br/>NestJS REST + Swagger]
  end

  WEB[apps/web<br/>Next.js]

  CAM -- ingestão agendada --> WK
  WK <--> RD
  WK -- upsert idempotente --> PG
  API --> PG
  API <--> RD
  WEB -- HTTP --> API
```

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

# 4. Subir web (3000), API (3001) e worker em modo dev
pnpm dev
```

- Front-end: http://localhost:3000
- API: http://localhost:3001 · health check em `/health` · Swagger em `/docs`

## Scripts

| Comando           | O que faz                                           |
| ----------------- | --------------------------------------------------- |
| `pnpm dev`        | Sobe todos os apps em modo desenvolvimento          |
| `pnpm build`      | Build de todos os pacotes e apps                    |
| `pnpm lint`       | ESLint em todo o monorepo                           |
| `pnpm typecheck`  | Checagem de tipos                                   |
| `pnpm test`       | Testes unitários (Vitest)                           |
| `pnpm test:e2e`   | Testes e2e da API (Supertest; exige Postgres/Redis) |
| `pnpm db:migrate` | Cria/aplica migrations em desenvolvimento           |
| `pnpm format`     | Formata o código com Prettier                       |

## Decisões técnicas

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

| Fonte                                                                          | Uso                       | Fase |
| ------------------------------------------------------------------------------ | ------------------------- | ---- |
| [Dados Abertos da Câmara](https://dadosabertos.camara.leg.br/swagger/api.html) | Deputados e despesas      | 1    |
| Dados Abertos do Senado (CSV da CEAPS)                                         | Senadores e despesas      | 3    |
| [Portal da Transparência (CGU)](https://api.portaldatransparencia.gov.br)      | Emendas parlamentares     | 3    |
| Dados Abertos do TSE                                                           | Bens e contas de campanha | 4+   |

## Roadmap

- [x] **Fase 0**: monorepo, Docker Compose, Prisma, lint/format, CI
- [ ] **Fase 1**: ingestão da Câmara, API de parlamentares/despesas, busca e página do parlamentar
- [ ] **Fase 2**: rankings, fornecedores, comparação, estatísticas, cache
- [ ] **Fase 3**: Senado e emendas parlamentares
- [ ] **Fase 4**: pontos de atenção (detecção simples de valores fora do padrão)
- [ ] **Fase 5**: deploy e README final
