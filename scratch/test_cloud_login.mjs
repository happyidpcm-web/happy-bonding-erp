import { PrismaClient } from '@prisma/client';

const neonUrl = process.env.CLOUD_DATABASE_URL;
if (!neonUrl) throw new Error("Set CLOUD_DATABASE_URL explicitly");

const prisma = new PrismaClient({
  datasources: { db: { url: neonUrl } }
});

async function testCloudDb() {
  console.log("Testing user and branch queries directly on Neon Cloud DB...");
  const user = await prisma.user.findFirst({
    include: { role: true, branches: true }
  });
  console.log("Found user:", user?.email);

  if (!user) throw new Error("No user found");
  if (user) {
    const branches = await prisma.branch.findMany({
      where: { organizationId: user.organizationId, active: true }
    });
    console.log("Active branches found:", branches.length, branches.map(b => b.name));
  }

  console.log("✅ Neon Cloud DB query check passed; password/token login not tested.");
  await prisma.$disconnect();
}

testCloudDb().catch(e => {
  console.error("Test failed:", e);
  process.exit(1);
});
