import assert from 'node:assert/strict';
import { test } from 'node:test';
import express from 'express';
import { preliminaryBalances } from '../server/preliminary-balances.ts';

test('summary separates invoice credits, opening amounts and payment movement without inventing equity', () => {
  const result = preliminaryBalances({
    stock: [{ quantity: '3', variant: { purchasePrice: '100.25' } }, { quantity: '-1', variant: { purchasePrice: '50' } }],
    invoices: [
      { grandTotal: 1000, paidAmount: 400, creditNotes: [{ amount: 100 }] },
      { grandTotal: 100, paidAmount: 100, creditNotes: [{ amount: 30 }] },
    ],
    parties: [{ openingBalance: 150, openingBalanceType: 'TO_COLLECT' }, { openingBalance: 200, openingBalanceType: 'TO_PAY' }],
    purchases: [{ amount: 500, details: { paidAmount: 200 } }, { amount: 99, details: {} }, { amount: 10, details: { paidAmount: 20 } }],
    payments: [{ direction: 'IN', amount: 500 }, { direction: 'OUT', amount: 650 }],
  });
  assert.deepEqual(result, { stockValue: 250.75, negativeStockItems: 1, invoiceDue: 500, invoiceCredit: 30, openingReceivable: 150, openingPayable: 200, purchaseDue: 300, missingPurchasePayments: 2, received: 500, paid: 650, netMovement: -150 });
});

test('an empty branch reports zero recorded amounts', () => {
  const result = preliminaryBalances({ stock: [], invoices: [], parties: [], purchases: [], payments: [] });
  assert.ok(Object.values(result).every(value => value === 0));
});

test('balance API enforces report permissions and branch scope with a consistent snapshot', async t => {
  process.env.DATABASE_URL ||= 'postgresql://unused:unused@127.0.0.1:1/unused';
  const { db } = await import('../server/db.ts');
  const { reportsRouter } = await import('../server/reports.ts');
  const original = db.$transaction;
  const calls: Array<{ model: string; args: any }> = [];
  db.$transaction = (async (fn: any, options: any) => {
    assert.equal(options.isolationLevel, 'RepeatableRead');
    return fn(Object.fromEntries(['stockBalance', 'salesInvoice', 'party', 'voucher', 'payment'].map(model => [model, { findMany: async (args: any) => { calls.push({ model, args }); return []; } }])));
  }) as any;
  t.after(() => { db.$transaction = original; });
  const app = express();
  app.use((req, _res, next) => { req.session = { userId: 'u', organizationId: 'org', branchIds: ['branch'], permissions: req.headers['x-deny'] ? [] : ['reports.read'], tokenVersion: 0 }; next(); });
  app.use('/reports', reportsRouter);
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  t.after(() => new Promise<void>(resolve => server.close(() => resolve())));
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  const url = `http://127.0.0.1:${address.port}/reports/balance-summary`;
  assert.equal((await fetch(url, { headers: { 'x-deny': '1' } })).status, 403);
  assert.equal((await fetch(url, { headers: { 'x-branch-id': 'other' } })).status, 403);
  assert.equal(calls.length, 0);
  const response = await fetch(url);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.stockValue, 0);
  assert.ok(Number.isFinite(Date.parse(body.generatedAt)));
  assert.equal(calls.length, 5);
  for (const { model, args } of calls) {
    assert.equal(args.where.branchId, 'branch');
    assert.equal(model === 'stockBalance' ? args.where.branch.organizationId : args.where.organizationId, 'org');
  }
  assert.equal(calls.find(c => c.model === 'salesInvoice')!.args.where.status, 'POSTED');
  assert.equal(calls.find(c => c.model === 'voucher')!.args.where.type, 'Purchase Invoice');
});
