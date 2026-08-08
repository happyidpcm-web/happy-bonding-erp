-- CreateTable
CREATE TABLE "InvoiceSetting" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "invoicePrefix" TEXT NOT NULL DEFAULT 'HB/SL',
    "paymentTermsDays" INTEGER NOT NULL DEFAULT 30,
    "terms" TEXT NOT NULL DEFAULT 'NO REFUND ONCE SOLD. EXCHANGE ONLY AS PER STORE POLICY.',
    "bankName" TEXT,
    "accountName" TEXT,
    "accountNumber" TEXT,
    "ifsc" TEXT,
    "upiId" TEXT,
    "qrText" TEXT,
    "signatureText" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvoiceSetting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InvoiceSetting_organizationId_key" ON "InvoiceSetting"("organizationId");

-- AddForeignKey
ALTER TABLE "InvoiceSetting" ADD CONSTRAINT "InvoiceSetting_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
