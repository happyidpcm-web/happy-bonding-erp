-- AlterTable
ALTER TABLE "SalesInvoice" ADD COLUMN     "additionalCharges" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "invoiceDiscount" DECIMAL(14,2) NOT NULL DEFAULT 0;
