import { PrismaClient } from '@prisma/client';

const neonUrl = "postgresql://neondb_owner:npg_T3FWLuz0kepy@ep-still-morning-b3zsbjwt-pooler.c-4.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&connect_timeout=30";

const prisma = new PrismaClient({
  datasources: { db: { url: neonUrl } }
});

async function testCloudDb() {
  console.log("Testing user and branch queries directly on Neon Cloud DB...");
  const user = await prisma.user.findFirst({
    include: { role: true, branches: true }
  });
  console.log("Found user:", user?.email);

  if (user) {
    const branches = await prisma.branch.findMany({
      where: { organizationId: user.organizationId, active: true }
    });
    console.log("Active branches found:", branches.length, branches.map(b => b.name));
  }

  console.log("✅ Neon Cloud DB query test PASSED successfully!");
  await prisma.$disconnect();
}

testCloudDb().catch(e => {
  console.error("Test failed:", e);
  process.exit(1);
});
