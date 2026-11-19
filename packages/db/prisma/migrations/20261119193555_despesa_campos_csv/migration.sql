-- AlterTable
ALTER TABLE "Despesa" ADD COLUMN     "codDocumento" TEXT,
ADD COLUMN     "passageiro" TEXT,
ADD COLUMN     "trecho" TEXT;

-- AlterTable
ALTER TABLE "SyncRun" ADD COLUMN     "detalhes" JSONB;
