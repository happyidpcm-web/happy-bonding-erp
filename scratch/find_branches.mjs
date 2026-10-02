import { PrismaClient } from '@prisma/client';

const neonUrl = "postgresql://neondb_owner:npg_T3FWLuz0kepy@ep-still-morning-b3zsbjwt-pooler.c-4.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&connect_timeout=30";

const prisma = new PrismaClient({
  datasources: { db: { url: neonUrl } }
});

async function findBranchesAndUsers() {
  console.log("Fetching Branches...");
  const branches = await prisma.branch.findMany({
    include: {
      memberships: {
        include: {
          user: { select: { id: true, name: true, email: true, role: { select: { name: true } } } }
        }
      }
    }
  });

  console.log("--- BRANCHES ---");
  for (const b of branches) {
    console.log(`Branch ID: ${b.id} | Code: ${b.code} | Name: ${b.name}`);
    for (const m of b.memberships) {
      console.log(`   User: ${m.user.name} | Email: ${m.user.email} | Role: ${m.user.role.name}`);
    }
  }

  console.log("\n--- ALL USERS ---");
  const users = await prisma.user.findMany({
    include: { role: true, branches: { include: { branch: true } } }
  });
  for (const u of users) {
    console.log(`User: ${u.name} | Email: ${u.email} | Role: ${u.role.name} | Branches: ${u.branches.map(x => x.branch.name).join(", ")}`);
  }

  await prisma.$disconnect();
}

findBranchesAndUsers().catch(console.error);
