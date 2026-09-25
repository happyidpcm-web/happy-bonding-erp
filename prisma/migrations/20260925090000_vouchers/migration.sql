-- CreateTable
CREATE TABLE "Voucher" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "party" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Open',
    "dueIn" TEXT,
    "notes" TEXT,
    "items" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Voucher_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Voucher_organizationId_branchId_type_date_idx" ON "Voucher"("organizationId", "branchId", "type", "date");

-- CreateIndex
CREATE UNIQUE INDEX "Voucher_organizationId_branchId_type_number_key" ON "Voucher"("organizationId", "branchId", "type", "number");
