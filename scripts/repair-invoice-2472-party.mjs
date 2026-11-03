import 'dotenv/config';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { PrismaClient, Prisma } from '@prisma/client';

// Single correction authorized by the owner, verified against the 2026-11-03 backup.
export const correction = Object.freeze({
  id: 'cmvzhb427002y4t87dsvfvwus',
  organizationId: 'happy-bonding',
  branchId: 'cmti1m17y0001w4zwwin3hmr8',
  invoiceNumber: 'HB/SL/26-27/2472',
  oldPartyId: 'cmvqcwrmc04ml4tshelhw7ug7',
  newPartyId: 'cmvqcwrz004n54tsh6753bg1w',
  phone: '6382946743',
});

export async function repairInvoice2472(tx, apply = false) {
  const c = correction;
  const include = {
    lines: { orderBy: { id: 'asc' } },
    payments: { orderBy: { id: 'asc' } },
    creditNotes: { orderBy: { id: 'asc' } },
  };
  const invoice = await tx.salesInvoice.findUnique({ where: { id: c.id }, include });
  if (!invoice) return 'Invoice not present in this database; no changes made.';
  for (const key of ['organizationId', 'branchId', 'invoiceNumber']) {
    assert.equal(invoice[key], c[key], `Unexpected invoice ${key}; no correction applied`);
  }
  const target = await tx.party.findUniqueOrThrow({ where: { id: c.newPartyId } });
  assert.equal(target.organizationId, c.organizationId);
  assert.equal(target.branchId, c.branchId);
  assert.equal(target.phone, c.phone);
  assert.equal(target.type, 'CUSTOMER');
  assert.equal(target.active, true);
  if (invoice.partyId === c.newPartyId) return 'Invoice 2472 already linked to 6382946743; no changes made.';
  assert.equal(invoice.partyId, c.oldPartyId, 'Customer link changed since the backup; correction stopped');
  assert.equal(invoice.status, 'POSTED');
  assert.equal(invoice.invoiceDate.toISOString().slice(0, 10), '2026-11-02');
  assert.equal(Number(invoice.grandTotal), 700);
  assert.equal(Number(invoice.paidAmount), 700);
  assert.equal(invoice.paymentStatus, 'PAID');
  assert.equal(invoice.creditNotes.length, 0, 'Invoice has credit notes; correction requires review');
  if (!apply) return 'Verified invoice 2472: change customer from 9087761903 to 6382946743. Dry run only.';

  const changed = await tx.salesInvoice.updateMany({
    where: { id: c.id, organizationId: c.organizationId, branchId: c.branchId, partyId: c.oldPartyId },
    data: { partyId: c.newPartyId },
  });
  assert.equal(changed.count, 1, 'Invoice changed concurrently; correction stopped');
  const after = await tx.salesInvoice.findUniqueOrThrow({ where: { id: c.id }, include });
  assert.deepEqual(after, { ...invoice, partyId: c.newPartyId }, 'Unexpected change beyond the customer link');
  await tx.auditEvent.create({ data: {
    organizationId: c.organizationId,
    action: 'sales_invoice.party_corrected',
    entityType: 'SalesInvoice', entityId: c.id,
    metadata: {
      invoiceNumber: c.invoiceNumber, branchId: c.branchId,
      previousPartyId: c.oldPartyId, partyId: c.newPartyId,
      reason: 'Owner requested correction of invoice 2472 to customer mobile 6382946743.',
      grandTotal: String(invoice.grandTotal), paidAmount: String(invoice.paidAmount),
    },
  } });
  return 'Verified: HB/SL/26-27/2472 linked to 6382946743. All other invoice fields, items and payment allocations unchanged.';
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const db = new PrismaClient();
  try {
    console.log(await db.$transaction(tx => repairInvoice2472(tx, process.argv.includes('--apply')),
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 30000 }));
  } finally { await db.$disconnect(); }
}
