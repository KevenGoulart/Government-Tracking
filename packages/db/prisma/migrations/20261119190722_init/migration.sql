-- Busca por similaridade de nomes (índice GIN em Parlamentar.nomeBusca)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- CreateEnum
CREATE TYPE "Casa" AS ENUM ('CAMARA', 'SENADO');

-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('RUNNING', 'SUCCESS', 'FAILED');

-- CreateTable
CREATE TABLE "Parlamentar" (
    "id" TEXT NOT NULL,
    "idExterno" TEXT NOT NULL,
    "casa" "Casa" NOT NULL,
    "nome" TEXT NOT NULL,
    "nomeBusca" TEXT NOT NULL,
    "nomeCivil" TEXT,
    "partido" TEXT,
    "uf" CHAR(2) NOT NULL,
    "fotoUrl" TEXT,
    "email" TEXT,
    "emExercicio" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Parlamentar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Fornecedor" (
    "id" TEXT NOT NULL,
    "chave" TEXT NOT NULL,
    "documento" TEXT,
    "nome" TEXT NOT NULL,
    "nomeNormalizado" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Fornecedor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Categoria" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Categoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Despesa" (
    "id" TEXT NOT NULL,
    "idExterno" TEXT NOT NULL,
    "parlamentarId" TEXT NOT NULL,
    "fornecedorId" TEXT,
    "categoriaId" TEXT NOT NULL,
    "ano" INTEGER NOT NULL,
    "mes" INTEGER NOT NULL,
    "dataDocumento" DATE,
    "tipoDocumento" TEXT,
    "numDocumento" TEXT,
    "valorDocumento" DECIMAL(12,2) NOT NULL,
    "valorGlosa" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "valorLiquido" DECIMAL(12,2) NOT NULL,
    "urlDocumento" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Despesa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncRun" (
    "id" TEXT NOT NULL,
    "fonte" TEXT NOT NULL,
    "escopo" JSONB,
    "inicio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fim" TIMESTAMP(3),
    "status" "SyncStatus" NOT NULL DEFAULT 'RUNNING',
    "processados" INTEGER NOT NULL DEFAULT 0,
    "erro" TEXT,

    CONSTRAINT "SyncRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Parlamentar_partido_uf_idx" ON "Parlamentar"("partido", "uf");

-- CreateIndex
CREATE INDEX "Parlamentar_nomeBusca_idx" ON "Parlamentar" USING GIN ("nomeBusca" gin_trgm_ops);

-- CreateIndex
CREATE UNIQUE INDEX "Parlamentar_casa_idExterno_key" ON "Parlamentar"("casa", "idExterno");

-- CreateIndex
CREATE UNIQUE INDEX "Fornecedor_chave_key" ON "Fornecedor"("chave");

-- CreateIndex
CREATE INDEX "Fornecedor_documento_idx" ON "Fornecedor"("documento");

-- CreateIndex
CREATE UNIQUE INDEX "Categoria_slug_key" ON "Categoria"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Despesa_idExterno_key" ON "Despesa"("idExterno");

-- CreateIndex
CREATE INDEX "Despesa_parlamentarId_ano_mes_idx" ON "Despesa"("parlamentarId", "ano", "mes");

-- CreateIndex
CREATE INDEX "Despesa_ano_mes_idx" ON "Despesa"("ano", "mes");

-- CreateIndex
CREATE INDEX "Despesa_categoriaId_ano_idx" ON "Despesa"("categoriaId", "ano");

-- CreateIndex
CREATE INDEX "Despesa_fornecedorId_idx" ON "Despesa"("fornecedorId");

-- CreateIndex
CREATE INDEX "SyncRun_fonte_inicio_idx" ON "SyncRun"("fonte", "inicio");

-- CreateIndex
CREATE INDEX "SyncRun_status_idx" ON "SyncRun"("status");

-- AddForeignKey
ALTER TABLE "Despesa" ADD CONSTRAINT "Despesa_parlamentarId_fkey" FOREIGN KEY ("parlamentarId") REFERENCES "Parlamentar"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Despesa" ADD CONSTRAINT "Despesa_fornecedorId_fkey" FOREIGN KEY ("fornecedorId") REFERENCES "Fornecedor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Despesa" ADD CONSTRAINT "Despesa_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "Categoria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
