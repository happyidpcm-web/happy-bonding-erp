import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { PrismaClient } from '@prisma/client';

// Match the existing deployment's additive schema updates without resetting data.
const migrations = [
  '202611230001_group_shirts',
  '202611230002_group_shirt_pricing',
  '202611230003_group_shirt_production',
  '202611240001_group_shirt_vesti_purchase',
  '202611250001_group_shirt_amount_opening',
  '202611250002_group_shirt_cost_payment_status',
];
const prisma = new PrismaClient();
try {
  const statements = [];
  for (const name of migrations) {
    const sql = await readFile(new URL(`../prisma/migrations/${name}/migration.sql`, import.meta.url), 'utf8');
    statements.push(...sql.replace(/CREATE TABLE /g, 'CREATE TABLE IF NOT EXISTS ')
      .replace(/CREATE UNIQUE INDEX /g, 'CREATE UNIQUE INDEX IF NOT EXISTS ')
      .replace(/CREATE INDEX /g, 'CREATE INDEX IF NOT EXISTS ')
      .replace(/ADD COLUMN /g, 'ADD COLUMN IF NOT EXISTS ')
      .split(';').map(statement => statement.trim()).filter(Boolean));
  }
  await prisma.$transaction(async tx => {
    for (const statement of statements) await tx.$executeRawUnsafe(statement);
    // Select every model field to verify both new and previously created tables.
    await tx.groupShirtOrder.findFirst();
  });
  console.log('Group Shirts orders, production costs and amount-opening table verified.');
} finally {
  await prisma.$disconnect();
}
