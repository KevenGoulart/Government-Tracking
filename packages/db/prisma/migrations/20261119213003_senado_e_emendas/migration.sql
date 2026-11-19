-- AlterTable
ALTER TABLE "Categoria" ADD COLUMN     "casa" "Casa" NOT NULL DEFAULT 'CAMARA';

-- CreateTable
CREATE TABLE "Emenda" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "ano" INTEGER NOT NULL,
    "numero" TEXT,
    "tipo" TEXT NOT NULL,
    "autor" TEXT NOT NULL,
    "parlamentarId" TEXT,
    "observacaoAutor" TEXT,
    "localidade" TEXT,
    "funcao" TEXT,
    "subfuncao" TEXT,
    "valorEmpenhado" DECIMAL(15,2) NOT NULL,
    "valorLiquidado" DECIMAL(15,2) NOT NULL,
    "valorPago" DECIMAL(15,2) NOT NULL,
    "valorRestoInscrito" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "valorRestoCancelado" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "valorRestoPago" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Emenda_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Emenda_codigo_key" ON "Emenda"("codigo");

-- CreateIndex
CREATE INDEX "Emenda_parlamentarId_ano_idx" ON "Emenda"("parlamentarId", "ano");

-- CreateIndex
CREATE INDEX "Emenda_ano_idx" ON "Emenda"("ano");

-- CreateIndex
CREATE INDEX "Categoria_casa_idx" ON "Categoria"("casa");

-- AddForeignKey
ALTER TABLE "Emenda" ADD CONSTRAINT "Emenda_parlamentarId_fkey" FOREIGN KEY ("parlamentarId") REFERENCES "Parlamentar"("id") ON DELETE SET NULL ON UPDATE CASCADE;
