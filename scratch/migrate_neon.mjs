import { PrismaClient } from '@prisma/client';

const neonUrl = "postgresql://neondb_owner:npg_T3FWLuz0kepy@ep-still-morning-b3zsbjwt-pooler.c-4.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&connect_timeout=30";

const prisma = new PrismaClient({
  datasources: { db: { url: neonUrl } }
});

async function main() {
  console.log("Connecting to Neon Cloud Database...");
  
  // 1. Add active to Branch
  console.log("1. Adding 'active' column to Branch table...");
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "Branch" ADD COLUMN IF NOT EXISTS "active" BOOLEAN NOT NULL DEFAULT true;
  `);

  // 2. Add allowNegativeStock to Branch if missing
  console.log("2. Adding 'allowNegativeStock' column to Branch table...");
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "Branch" ADD COLUMN IF NOT EXISTS "allowNegativeStock" BOOLEAN NOT NULL DEFAULT false;
  `);

  // Get default branch ID
  const defaultBranch = await prisma.$queryRawUnsafe(`SELECT id FROM "Branch" LIMIT 1;`);
  const branchId = defaultBranch[0]?.id;
  console.log("Default Branch ID:", branchId);

  if (branchId) {
    // 3. Add branchId to Party if missing
    console.log("3. Ensuring branchId column in Party table...");
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "Party" ADD COLUMN IF NOT EXISTS "branchId" TEXT;
    `);
    await prisma.$executeRawUnsafe(`
      UPDATE "Party" SET "branchId" = '${branchId}' WHERE "branchId" IS NULL;
    `);

    // 4. Add branchId to Product if missing
    console.log("4. Ensuring branchId column in Product table...");
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "branchId" TEXT;
    `);
    await prisma.$executeRawUnsafe(`
      UPDATE "Product" SET "branchId" = '${branchId}' WHERE "branchId" IS NULL;
    `);

    // 5. Add branchId to InvoiceSetting if missing
    console.log("5. Ensuring branchId column in InvoiceSetting table...");
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "InvoiceSetting" ADD COLUMN IF NOT EXISTS "branchId" TEXT;
    `);
    await prisma.$executeRawUnsafe(`
      UPDATE "InvoiceSetting" SET "branchId" = '${branchId}' WHERE "branchId" IS NULL;
    `);
  }

  console.log("✅ Neon Database Migration Successfully Applied!");
  await prisma.$disconnect();
}

main().catch(err => {
  console.error("Migration Error:", err);
  process.exit(1);
});
