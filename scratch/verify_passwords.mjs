import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const neonUrl = "postgresql://neondb_owner:npg_T3FWLuz0kepy@ep-still-morning-b3zsbjwt-pooler.c-4.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&connect_timeout=30";

const prisma = new PrismaClient({
  datasources: { db: { url: neonUrl } }
});

async function verifyPass() {
  const users = await prisma.user.findMany();
  const testPasswords = ["HappyBonding@2026", "123456", "admin123", "pcm123"];

  for (const u of users) {
    console.log(`User: ${u.email}`);
    for (const pass of testPasswords) {
      const match = await bcrypt.compare(pass, u.passwordHash);
      if (match) console.log(`   MATCHED PASSWORD: "${pass}"`);
    }
  }
  await prisma.$disconnect();
}

verifyPass().catch(console.error);
