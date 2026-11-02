import assert from 'node:assert/strict';
import { test } from 'node:test';
import express from 'express';

test('report API enforces permissions and branch scope, filters posted invoices, and rejects invalid ranges', async t => {
  process.env.DATABASE_URL ||= 'postgresql://unused:unused@127.0.0.1:1/unused';
  const { db } = await import('../server/db.ts');
  const { reportsRouter } = await import('../server/reports.ts');
  const replaceMethod = (object: any, key: string, replacement: (...args: any[]) => any) => {
    const original = object[key]; object[key] = replacement;
    t.after(() => { object[key] = original; });
  };
  const calls: Array<{ model: string; args: any }> = [];
  replaceMethod(db.productVariant, 'findMany', async (args: unknown) => {
    calls.push({ model: 'variants', args });
    return [{ id: 'v1', sku: 'SHIRT', size: 'M', product: { name: 'Shirt', category: 'Shirts' } }];
  });
  replaceMethod(db.salesInvoice, 'findMany', async (args: unknown) => {
    calls.push({ model: 'sales', args });
    return [{ invoiceNumber: 'TEST/1', party: { name: 'Customer' }, couponDiscount: '50', grandTotal: '850', paidAmount: '800', invoiceDate: new Date('2026-11-02T00:00:00Z'), createdAt: new Date('2026-11-02T05:00:00Z'), lines: [{ variantId: 'v1', itemName: 'Shirt', sku: 'SHIRT', quantity: '3', total: '900' }] }];
  });
  replaceMethod(db.voucher, 'findMany', async (args: unknown) => {
    calls.push({ model: 'purchases', args });
    return [{ date: new Date('2026-11-02T00:00:00Z'), createdAt: new Date('2026-11-02T05:00:00Z'), items: [{ variantId: 'v1', name: 'Shirt', qty: 10, amount: 1500 }] }];
  });
  replaceMethod(db, '$transaction', async (queries: Promise<unknown>[]) => Promise.all(queries));
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
  const url = `http://127.0.0.1:${address.port}/reports/item-summary`;
  assert.equal((await fetch(url, { headers: { 'x-branch-id': 'other' } })).status, 403);
  assert.equal((await fetch(url, { headers: { 'x-test-deny': 'yes' } })).status, 403);
  assert.equal(calls.length, 0);
  assert.equal((await fetch(`${url}?filter=Custom+Range&from=2026-11-03&to=2026-11-01`)).status, 400);
  assert.equal(calls.length, 0);
  const response = await fetch(`${url}?filter=Custom+Range&from=2026-11-02&to=2026-11-02`);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.rows[0].salesQty, 3); assert.equal(body.rows[0].purchaseQty, 10);
  assert.equal(body.rows[0].salesAmount, 900); assert.equal(body.rows[0].purchaseAmount, 1500);
  const sales = calls.find(c => c.model === 'sales')!.args;
  assert.equal(sales.where.status, 'POSTED'); assert.equal(sales.where.organizationId, 'org1'); assert.equal(sales.where.branchId, 'b1');
  assert.equal(sales.where.invoiceDate.gte.toISOString(), '2026-11-02T00:00:00.000Z');
  assert.equal(sales.where.invoiceDate.lt.toISOString(), '2026-11-03T00:00:00.000Z');
  const couponResponse = await fetch(url.replace('item-summary', 'table/coupon-discount') + '?filter=Custom+Range&from=2026-11-02&to=2026-11-02');
  assert.equal(couponResponse.status, 200);
  const coupon = await couponResponse.json();
  assert.equal(coupon.rows[0]['Coupon Discount'], 50);
  assert.equal(coupon.rows[0].Amount, 850);
  assert.equal(coupon.rows[0].Balance, 50);
  assert.ok(coupon.moneyColumns.includes('Coupon Discount'));
  const purchases = calls.find(c => c.model === 'purchases')!.args;
  assert.equal(purchases.where.type, 'Purchase Invoice'); assert.equal(purchases.where.organizationId, 'org1'); assert.equal(purchases.where.branchId, 'b1');
});
