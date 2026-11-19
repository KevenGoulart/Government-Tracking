# syntax=docker/dockerfile:1
# Imagem do worker de ingestão. O contexto é a raiz do monorepo:
#   docker build -f apps/worker/Dockerfile -t raio-x-worker .
ARG NODE_IMAGE=node:24-alpine

FROM ${NODE_IMAGE} AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH CI=1 HUSKY=0 TURBO_TELEMETRY_DISABLED=1
RUN npm install -g pnpm@11.21.0
WORKDIR /repo

# 1. Recorta o monorepo para o worker e suas dependências internas (db, shared)
FROM base AS prune
COPY . .
RUN pnpm dlx turbo@2.11.13 prune @raio-x/worker --docker

# 2. Instala (camada cacheada enquanto os package.json não mudam), gera o client e compila
FROM base AS build
COPY --from=prune /repo/out/json/ .
RUN pnpm install --frozen-lockfile
COPY --from=prune /repo/out/full/ .
# prisma.config.ts exige DATABASE_URL, mas o generate não se conecta ao banco
RUN DATABASE_URL=postgresql://build@localhost/build pnpm turbo run build --filter=@raio-x/worker
# Troca as dependências pelas de produção (ver apps/api/Dockerfile)
RUN find . -name node_modules -type d -prune -exec rm -rf {} + \
 && pnpm install --prod --frozen-lockfile --offline --ignore-scripts

# 3. Imagem final
FROM ${NODE_IMAGE} AS runtime
# Heap limitado: a sincronização da Câmara cabe em ~190 MB de heap (pico de ~420 MB de RSS
# com o ano inteiro), o que permite rodar em instâncias de 512 MB (ver docs/decisoes.md).
ENV NODE_ENV=production NODE_OPTIONS=--max-old-space-size=256
COPY --from=build --chown=node:node /repo /app
WORKDIR /app/apps/worker
USER node
# Carga manual, fora da fila: docker run --rm ... raio-x-worker node dist/cli.js inicial
CMD ["node", "--enable-source-maps", "dist/main.js"]
