import assert from 'node:assert/strict';
import { test } from 'node:test';
import express from 'express';

test('coupon report scopes posted coupon invoices and returns separate coupon and final amounts', async t => {
  process.env.DATABASE_URL ||= 'postgresql://unused:unused@127.0.0.1:1/unused';
  const { db } = await import('../server/db.ts');
  const { reportsRouter } = await import('../server/reports.ts');
  const original = db.salesInvoice.findMany;
  let query: any;
  db.salesInvoice.findMany = (async (args: any) => {
    query = args;
    return [
      { invoiceDate: new Date('2026-11-06'), createdAt: new Date('2026-11-06T05:00:00Z'), invoiceNumber: 'INV-1', party: { name: 'Kumar', phone: '9876543210' }, couponDiscount: '75.50', grandTotal: '924.50' },
      { invoiceDate: new Date('2026-11-06'), createdAt: new Date('2026-11-06T06:00:00Z'), invoiceNumber: 'INV-2', party: null, couponDiscount: '50', grandTotal: '450' },
    ];
  }) as any;
  t.after(() => { db.salesInvoice.findMany = original; });
  const app = express();
  app.use((req, _res, next) => {
    req.session = { userId: 'u1', organizationId: 'org1', branchIds: ['b1'], permissions: req.headers['x-test-deny'] ? [] : ['reports.read'], tokenVersion: 0 };
    next();
  });
  app.use('/reports', reportsRouter);
  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => res.status(400).json({ error: String(error) }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  t.after(() => new Promise<void>(resolve => server.close(() => resolve())));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');

  const url = 'http://127.0.0.1:' + address.port + '/reports/table/coupon-report?filter=Custom+Range&from=2026-11-06&to=2026-11-06';
  assert.equal((await fetch(url, { headers: { 'x-branch-id': 'other' } })).status, 403);
  assert.equal((await fetch(url, { headers: { 'x-test-deny': 'yes' } })).status, 403);
  assert.equal(query, undefined);
  const response = await fetch(url);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(query.where.organizationId, 'org1');
  assert.equal(query.where.branchId, 'b1');
  assert.equal(query.where.status, 'POSTED');
  assert.deepEqual(query.where.couponDiscount, { gt: 0 });
  assert.equal(query.where.invoiceDate.gte.toISOString(), '2026-11-06T00:00:00.000Z');
  assert.equal(query.where.invoiceDate.lt.toISOString(), '2026-11-07T00:00:00.000Z');
  assert.deepEqual(body.moneyColumns, ['Coupon Discount', 'Invoice Amount']);
  assert.deepEqual(body.rows[0], { Date: '2026-11-06', Invoice: 'INV-1', Customer: 'Kumar', Phone: '9876543210', 'Coupon Discount': 75.5, 'Invoice Amount': 924.5 });
  assert.equal(body.rows[1].Customer, 'Cash Sale');
  assert.equal(body.rows.reduce((sum: number, row: any) => sum + row['Coupon Discount'], 0), 125.5);
});
