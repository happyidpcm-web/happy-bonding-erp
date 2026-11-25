import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
try {
  const migrations = [
    '202611250003_staff_attendance',
    '202611250004_attendance_only_staff',
  ];
  for (const migration of migrations) {
    const sql = await readFile(new URL(`../prisma/migrations/${migration}/migration.sql`, import.meta.url), 'utf8');
    for (const statement of sql.replace(/CREATE TABLE /g, 'CREATE TABLE IF NOT EXISTS ').replace(/CREATE UNIQUE INDEX /g, 'CREATE UNIQUE INDEX IF NOT EXISTS ').replace(/CREATE INDEX /g, 'CREATE INDEX IF NOT EXISTS ').split(';').map(value => value.trim()).filter(Boolean)) await prisma.$executeRawUnsafe(statement);
  }
  await prisma.attendanceStaff.findFirst();
  await prisma.attendanceEntry.findFirst();
  console.log('Attendance-only staff tables verified.');
} finally { await prisma.$disconnect(); }
