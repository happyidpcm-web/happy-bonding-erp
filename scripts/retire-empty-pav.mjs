import 'dotenv/config';
import { PrismaClient, Prisma } from '@prisma/client';

// Run on the production server after taking a database backup.
// Default is read-only. --apply only deactivates the verified empty duplicate.
const db = new PrismaClient();
const duplicateId = 'cmu7lp2da0001w478ry6fra25';
const retainedId = 'cmti1m17y0001w4zwwin3hmr8';
try {
  await db.$transaction(async tx => {
    const duplicate = await tx.branch.findUniqueOrThrow({ where: { id: duplicateId } });
    const retained = await tx.branch.findUniqueOrThrow({ where: { id: retainedId } });
    if (duplicate.code !== 'PAV' || retained.code !== 'PCM' || !retained.active || duplicate.organizationId !== retained.organizationId) {
      throw new Error('Branch identity check failed');
    }
    const counts = {};
    for (const model of ['product', 'party', 'stockBalance', 'stockMovement', 'salesInvoice', 'payment', 'creditNote', 'expense', 'voucher', 'offlineSyncQueue']) {
      counts[model] = await tx[model].count({ where: { branchId: duplicateId } });
    }
    const staff = await tx.userBranch.count({ where: { branchId: duplicateId, user: { active: true, role: { permissions: { has: '*' } } } } });
    const allActiveUsers = await tx.userBranch.count({ where: { branchId: duplicateId, user: { active: true } } });
    counts.nonOwnerUsers = allActiveUsers - staff;
    console.log(JSON.stringify({ duplicate: { id: duplicate.id, code: duplicate.code, active: duplicate.active }, retained: { id: retained.id, code: retained.code }, counts }, null, 2));
    if (Object.values(counts).some(count => count !== 0)) throw new Error('Duplicate is not empty or has staff assigned; no changes made');
    if (process.argv.includes('--apply') && duplicate.active) {
      await tx.branch.update({ where: { id: duplicateId }, data: { active: false } });
      await tx.auditEvent.create({ data: { organizationId: duplicate.organizationId, action: 'branch.deactivated.empty_duplicate', entityType: 'Branch', entityId: duplicateId, metadata: { retainedBranchId: retainedId, counts } } });
      console.log('Empty PAV deactivated. PCM and all business records preserved.');
    } else console.log('No changes made.');
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 30000 });
} finally { await db.$disconnect(); }
