import assert from 'node:assert/strict';
import { test } from 'node:test';
import express from 'express';

test('expense category report sums saved expenses and applies branch and calendar bounds', async t => {
  process.env.DATABASE_URL ||= 'postgresql://unused:unused@127.0.0.1:1/unused';
  const { db } = await import('../server/db.ts');
  const { reportTablesRouter } = await import('../server/report-tables.ts');
  const original = db.expense.findMany;
  let query: any;
  let empty = false;
  db.expense.findMany = (async (args: any) => {
    query = args;
    return empty ? [] : [
      { category: 'Shop Rent', amount: '1000.50', expenseDate: new Date('2026-11-05'), createdAt: new Date('2026-11-05T05:00:00Z') },
      { category: 'Shop Rent', amount: '500.25', expenseDate: new Date('2026-11-05'), createdAt: new Date('2026-11-05T06:00:00Z') },
      { category: 'Electricity', amount: '200', expenseDate: new Date('2026-11-05'), createdAt: new Date('2026-11-05T07:00:00Z') },
    ];
  }) as any;
  t.after(() => { db.expense.findMany = original; });
  const app = express();
  app.use((req, _res, next) => { req.session = { userId: 'u', organizationId: 'org', branchIds: ['branch'], permissions: ['reports.read'], tokenVersion: 0 }; next(); });
  app.use('/reports', reportTablesRouter);
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  t.after(() => new Promise<void>(resolve => server.close(() => resolve())));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const url = `http://127.0.0.1:${address.port}/reports/expense-category`;
  const response = await fetch(`${url}?filter=Custom+Range&from=2026-11-05&to=2026-11-05`);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual(body.rows, [{ Category: 'Shop Rent', Amount: 1500.75 }, { Category: 'Electricity', Amount: 200 }]);
  assert.equal(query.where.branchId, 'branch');
  assert.equal(query.where.organizationId, 'org');
  assert.equal(query.where.expenseDate.gte.toISOString(), '2026-11-05T00:00:00.000Z');
  assert.equal(query.where.expenseDate.lt.toISOString(), '2026-11-06T00:00:00.000Z');
  empty = true;
  assert.deepEqual((await (await fetch(`${url}?filter=All`)).json()).rows, []);
  assert.equal(query.where.expenseDate.gte, undefined);
  assert.equal(query.where.expenseDate.lt, undefined);
});
