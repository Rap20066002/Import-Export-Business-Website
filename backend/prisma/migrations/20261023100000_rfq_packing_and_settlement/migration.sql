-- CreateEnum
CREATE TYPE "ContainerType" AS ENUM ('DRY_20', 'DRY_40', 'REEFER');

-- AlterTable Product
ALTER TABLE "Product" ADD COLUMN "defaultPackagingKg" DOUBLE PRECISION NOT NULL DEFAULT 5;

-- AlterTable RFQ
ALTER TABLE "RFQ" ADD COLUMN "containerType" "ContainerType" NOT NULL DEFAULT 'DRY_20';
ALTER TABLE "RFQ" ADD COLUMN "packagingKg" DOUBLE PRECISION NOT NULL DEFAULT 5;
ALTER TABLE "RFQ" ADD COLUMN "numberOfBoxes" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "RFQ" ADD COLUMN "targetPriceCurrency" TEXT;

-- AlterTable Order
ALTER TABLE "Order" ADD COLUMN "estimatedWeightTons" DOUBLE PRECISION;
ALTER TABLE "Order" ADD COLUMN "finalWeightTons" DOUBLE PRECISION;
ALTER TABLE "Order" ADD COLUMN "invoicedAmount" DOUBLE PRECISION;
ALTER TABLE "Order" ADD COLUMN "amountReceived" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Order" ADD COLUMN "settlementNote" TEXT;

-- CreateTable
CREATE TABLE "OrderPayment" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "note" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recordedById" TEXT NOT NULL,

    CONSTRAINT "OrderPayment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OrderPayment_orderId_idx" ON "OrderPayment"("orderId");

ALTER TABLE "OrderPayment" ADD CONSTRAINT "OrderPayment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderPayment" ADD CONSTRAINT "OrderPayment_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
