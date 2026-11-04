import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
try {
  await prisma.$executeRawUnsafe('ALTER TABLE "SalesInvoice" ADD COLUMN IF NOT EXISTS "couponDiscount" DECIMAL(14,2) NOT NULL DEFAULT 0');
  await prisma.salesInvoice.findFirst({ select: { couponDiscount: true } });
  console.log('Coupon discount column and Prisma Client verified.');
} finally {
  await prisma.$disconnect();
}
