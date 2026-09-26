import 'dotenv/config';
import fs from 'node:fs';
import { PrismaClient, Prisma } from '@prisma/client';
import { hash } from 'bcryptjs';

// One-time recovery into an EMPTY local database. Never merge or replace live data.
const url = new URL(process.env.DATABASE_URL);
if (!['localhost', '127.0.0.1'].includes(url.hostname) || url.pathname !== '/happybonding_erp') {
  throw new Error('Restore is restricted to the local happybonding_erp database.');
}
const backup = JSON.parse(fs.readFileSync(process.argv[2] || 'backups/backup-2026-08-31.json', 'utf8'));
const d = backup.data;
const organizationId = backup.organizationId;
const db = new PrismaClient();
const fields = new Map(Prisma.dmmf.datamodel.models.map(m => [m.name, new Set(m.fields.filter(f => f.kind !== 'object').map(f => f.name))]));
const scalar = (model, row) => Object.fromEntries(Object.entries(row).filter(([key]) => fields.get(model).has(key)));
const passwordHash = await hash('HappyBonding@2026', 12);
try {
  await db.$transaction(async tx => {
    for (const model of Prisma.dmmf.datamodel.models) {
      const delegate = model.name[0].toLowerCase() + model.name.slice(1);
      if (await tx[delegate].count()) throw new Error(`Refusing restore: ${model.name} is not empty.`);
    }
    await tx.organization.create({ data: { id: organizationId, name: "Happy Bonding Men's Wear", phone: '7708030903', gstin: '33CWZPS9715D1ZU', pan: 'CWZPS9715D', stateCode: '33' } });
    const insert = async (model, rows = []) => {
      const delegate = model[0].toLowerCase() + model.slice(1);
      for (let start = 0; start < rows.length; start += 250) {
        await tx[delegate].createMany({ data: rows.slice(start, start + 250).map(row => scalar(model, row)) });
      }
    };
    await insert('Branch', d.branches);
    const owner = d.users.find(u => u.email === 'admin@happybonding.in');
    if (!owner) throw new Error('Expected owner account is absent; review backup users before restoring.');
    if (d.users.length !== 1) throw new Error('Additional user roles require explicit mapping.');
    await tx.role.create({ data: { id: owner.roleId, organizationId, name: 'Owner', permissions: ['*'] } });
    await tx.user.create({ data: { ...scalar('User', owner), organizationId, passwordHash } });
    await tx.userBranch.createMany({ data: d.branches.map(b => ({ userId: owner.id, branchId: b.id })) });
    await insert('Party', d.parties);
    await insert('TaxRate', d.taxRates);
    await insert('Product', d.products);
    await insert('ProductVariant', d.products.flatMap(p => p.variants || []));
    await insert('StockBalance', d.stockBalances);
    await insert('StockMovement', d.stockMovements);
    await insert('SalesInvoice', d.invoices);
    await insert('SalesInvoiceLine', d.invoiceLines);
    await insert('Payment', d.payments);
    await insert('Expense', d.expenses);
    if (d.invoiceSetting) await tx.invoiceSetting.create({ data: scalar('InvoiceSetting', d.invoiceSetting) });
    // The legacy backup omits sequences. Resume after the largest saved number
    // across branches because invoice numbers are unique per organization.
    const years = new Map();
    for (const invoice of d.invoices) {
      const match = invoice.invoiceNumber.match(/^(.*\/(\d{2}-\d{2})\/)(\d+)$/);
      if (match) {
        const prior = years.get(match[2]);
        if (!prior || Number(match[3]) >= prior.nextNumber) years.set(match[2], { prefix: match[1], nextNumber: Number(match[3]) + 1 });
      }
    }
    for (const branch of d.branches) for (const [financialYear, sequence] of years) {
      await tx.documentSequence.create({ data: { organizationId, branchId: branch.id, documentType: 'SALES', financialYear, ...sequence } });
    }
    await tx.auditEvent.create({ data: { organizationId, actorId: owner.id, action: 'backup.local_restore', entityType: 'Organization', entityId: organizationId, metadata: { sourceDate: backup.createdAt, missing: ['paymentAllocations', 'creditNotes', 'auditEvents', 'originalPasswords'], sequencesReconstructed: true } } });
  }, { timeout: 120000 });
  console.log(JSON.stringify({ restored: true, branches: await db.branch.count(), parties: await db.party.count(), products: await db.product.count(), invoices: await db.salesInvoice.count(), payments: await db.payment.count(), missingPaymentAllocations: true }));
} finally {
  await db.$disconnect();
}
