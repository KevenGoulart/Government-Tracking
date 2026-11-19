# Deploy

| Parte               | Onde                               | Configuração                             |
| ------------------- | ---------------------------------- | ---------------------------------------- |
| Front-end (Next.js) | Vercel                             | `apps/web/vercel.json`                   |
| API (NestJS)        | Render, web service (Docker)       | `render.yaml` + `apps/api/Dockerfile`    |
| Worker (BullMQ)     | Render, background worker (Docker) | `render.yaml` + `apps/worker/Dockerfile` |
| PostgreSQL 17       | Render Postgres                    | `render.yaml`                            |
| Redis               | Render Key Value (`noeviction`)    | `render.yaml`                            |

API, worker, banco e Redis ficam descritos num único Blueprint (`render.yaml`), versionado
com o código. As imagens Docker são construídas no CI a cada push, então um Dockerfile
quebrado aparece antes do deploy.

## 1. Render (API, worker, Postgres e Redis)

1. No Render: **New → Blueprint** e selecione este repositório. O Render lê o `render.yaml`
   e cria os quatro recursos.
2. Preencha as variáveis marcadas com `sync: false`:
   - `CORS_ORIGIN` (API): a URL da Vercel, ex.: `https://raio-x-publico.vercel.app`. Só o
     Swagger usa o navegador; o front chama a API pelo servidor.
   - `TRANSPARENCIA_API_KEY` (worker): opcional; sem ela as emendas ficam desabilitadas.
3. A cada deploy da API, o `preDeployCommand` aplica as migrations antes de a versão nova
   receber tráfego. Se uma migration falhar, a versão anterior continua no ar.
4. **Carga inicial automática**: ao subir com o banco vazio, o worker enfileira deputados,
   despesas da Câmara, senadores, despesas do Senado e (com a chave) emendas dos anos em
   `SYNC_INITIAL_YEARS`. Com um ano, leva ~6 minutos sem emendas (medido num container de 512 MB:
   4 min de deputados, que exigem uma requisição por deputado, e 2 min de despesas); cada ano de
   emendas soma ~7 minutos. Depois disso os agendamentos (cron) mantêm os dados em dia.

`APP_VERSION` não precisa ser definida: a API usa o `RENDER_GIT_COMMIT` que o Render injeta,
e a Vercel injeta `VERCEL_GIT_COMMIT_SHA` no front. Assim cada deploy usa chaves de cache
próprias (ver [decisoes.md](decisoes.md#cache-duas-camadas-ambas-versionadas)).

### Planos

O worker e o `preDeployCommand` exigem planos pagos no Render. O Blueprint usa os menores
que comportam o projeto (`starter` para API, worker e Key Value; `basic-256mb` para o
Postgres). Confira os preços atuais em <https://render.com/pricing>.

O worker cabe em 512 MB porque a imagem limita o heap do Node a 256 MB. A sincronização mais
pesada (cota da Câmara, ~210 mil linhas por ano) foi medida com esse limite num container de
512 MB: pico de ~420 MB de RSS. O porquê está em
[decisoes.md](decisoes.md#memória-do-worker).

O banco ocupa cerca de 210 MB com dois anos de dados (despesas das duas casas e emendas).

## 2. Vercel (front-end)

1. **Add New → Project**, importe o repositório e defina **Root Directory = `apps/web`**.
   O `vercel.json` já define o build pelo Turborepo (que compila `packages/shared` antes) e
   pula o deploy quando o commit não afeta o front (`turbo-ignore`).
2. Variável de ambiente: `API_URL` = URL pública da API no Render
   (ex.: `https://raio-x-api.onrender.com`).
3. O build não depende da API: todas as rotas são renderizadas por requisição.

## Rodar as imagens localmente

```bash
docker build -f apps/api/Dockerfile -t raio-x-api .
docker build -f apps/worker/Dockerfile -t raio-x-worker .

# Migrations
docker run --rm -e DATABASE_URL=... raio-x-api \
  sh -c "cd /app/packages/db && node_modules/.bin/prisma migrate deploy"

# API (aceita PORT, como nas plataformas de deploy)
docker run -p 3001:3001 -e DATABASE_URL=... -e REDIS_URL=... raio-x-api

# Worker com o mesmo limite de memória do plano
docker run --memory=512m -e DATABASE_URL=... -e REDIS_URL=... raio-x-worker

# Carga manual, fora da fila
docker run --rm -e DATABASE_URL=... -e REDIS_URL=... raio-x-worker node dist/cli.js inicial
```

Dentro do Docker Desktop, `host.docker.internal` aponta para o Postgres e o Redis do
`docker compose` local.
