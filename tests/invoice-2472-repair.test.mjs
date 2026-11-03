import assert from 'node:assert/strict';
import { test } from 'node:test';
import { correction as c, repairInvoice2472 } from '../scripts/repair-invoice-2472-party.mjs';

function fixture() {
  let invoice = {
    id: c.id, organizationId: c.organizationId, branchId: c.branchId,
    invoiceNumber: c.invoiceNumber, partyId: c.oldPartyId,
    invoiceDate: new Date('2026-11-02T00:00:00Z'), status: 'POSTED',
    grandTotal: '700', paidAmount: '700', paymentStatus: 'PAID',
    lines: [{ id: 'line', quantity: '1', total: '700' }],
    payments: [{ id: 'allocation', paymentId: 'payment', amount: '700' }], creditNotes: [],
  };
  const target = { id: c.newPartyId, organizationId: c.organizationId, branchId: c.branchId, phone: c.phone, type: 'CUSTOMER', active: true };
  const writes = [], audits = [];
  const tx = {
    salesInvoice: {
      findUnique: async () => invoice,
      findUniqueOrThrow: async () => invoice,
      updateMany: async args => {
        writes.push(args);
        invoice = { ...invoice, ...args.data };
        return { count: 1 };
      },
    },
    party: { findUniqueOrThrow: async () => target },
    auditEvent: { create: async args => { audits.push(args); } },
  };
  return { tx, invoice, target, writes, audits };
}

test('dry run performs no writes', async () => {
  const f = fixture();
  await repairInvoice2472(f.tx);
  assert.equal(f.writes.length, 0);
  assert.equal(f.audits.length, 0);
});

test('only the exact invoice party changes, audit is recorded, and reruns are harmless', async () => {
  const f = fixture();
  await repairInvoice2472(f.tx, true);
  assert.deepEqual(f.writes, [{
    where: { id: c.id, organizationId: c.organizationId, branchId: c.branchId, partyId: c.oldPartyId },
    data: { partyId: c.newPartyId },
  }]);
  assert.equal(f.audits.length, 1);
  assert.equal(f.audits[0].data.metadata.previousPartyId, c.oldPartyId);
  await repairInvoice2472(f.tx, true);
  assert.equal(f.writes.length, 1);
  assert.equal(f.audits.length, 1);
});

test('unexpected customer, branch, phone, totals or credit notes stop the correction', async () => {
  for (const change of [
    f => { f.invoice.partyId = 'another-party'; },
    f => { f.invoice.branchId = 'another-branch'; },
    f => { f.target.phone = '9087761903'; },
    f => { f.target.branchId = 'another-branch'; },
    f => { f.invoice.grandTotal = '900'; },
    f => { f.invoice.creditNotes.push({ id: 'credit' }); },
  ]) {
    const f = fixture(); change(f);
    await assert.rejects(repairInvoice2472(f.tx, true));
    assert.equal(f.writes.length, 0);
  }
});
