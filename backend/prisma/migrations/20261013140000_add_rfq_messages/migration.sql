-- CreateTable
CREATE TABLE "RfqMessage" (
    "id" SERIAL NOT NULL,
    "rfqId" INTEGER NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RfqMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RfqMessage_rfqId_createdAt_idx" ON "RfqMessage"("rfqId", "createdAt");

-- AddForeignKey
ALTER TABLE "RfqMessage" ADD CONSTRAINT "RfqMessage_rfqId_fkey" FOREIGN KEY ("rfqId") REFERENCES "RFQ"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RfqMessage" ADD CONSTRAINT "RfqMessage_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill buyer RFQ notes so existing additional notes are visible in the thread
INSERT INTO "RfqMessage" ("rfqId", "authorId", "body", "createdAt")
SELECT "id", "buyerId", "notes", "createdAt"
FROM "RFQ"
WHERE "notes" IS NOT NULL AND TRIM("notes") <> '';
