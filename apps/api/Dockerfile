# syntax=docker/dockerfile:1
# Imagem da API. O contexto é a raiz do monorepo:
#   docker build -f apps/api/Dockerfile -t raio-x-api .
ARG NODE_IMAGE=node:24-alpine

FROM ${NODE_IMAGE} AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH CI=1 HUSKY=0 TURBO_TELEMETRY_DISABLED=1
RUN npm install -g pnpm@11.21.0
WORKDIR /repo

# 1. Recorta o monorepo para a API e suas dependências internas (db, shared)
FROM base AS prune
COPY . .
RUN pnpm dlx turbo@2.11.13 prune @raio-x/api --docker

# 2. Instala (camada cacheada enquanto os package.json não mudam), gera o client e compila
FROM base AS build
COPY --from=prune /repo/out/json/ .
RUN pnpm install --frozen-lockfile
COPY --from=prune /repo/out/full/ .
# prisma.config.ts exige DATABASE_URL, mas o generate não se conecta ao banco
RUN DATABASE_URL=postgresql://build@localhost/build pnpm turbo run build --filter=@raio-x/api
# Troca as dependências pelas de produção (offline, a partir do store desta etapa). A árvore
# recortada vai inteira para a imagem final: os links do pnpm entre apps/api,
# packages/db e packages/shared são relativos e continuam válidos.
RUN find . -name node_modules -type d -prune -exec rm -rf {} + \
 && pnpm install --prod --frozen-lockfile --offline --ignore-scripts

# 3. Imagem final
FROM ${NODE_IMAGE} AS runtime
ENV NODE_ENV=production
COPY --from=build --chown=node:node /repo /app
WORKDIR /app/apps/api
USER node
# Migrations no deploy (o Prisma CLI é dependência do pacote db):
#   sh -c "cd /app/packages/db && node_modules/.bin/prisma migrate deploy"
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD wget -qO- "http://127.0.0.1:${PORT:-${API_PORT:-3001}}/health" >/dev/null || exit 1
CMD ["node", "--enable-source-maps", "dist/main.js"]
