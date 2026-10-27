import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { bulkProductInput, parseInput } from '../server/validation.ts';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
const item = { name: 'Shirt', category: 'Clothes', sku: 'SH-1', hsnCode: '6205', taxRate: 5, purchasePrice: 100, sellingPrice: 150, mrp: 180, openingStock: 10 };
test('bulk validation rejects invalid rows, duplicate codes and oversized batches', () => {
  for (const items of [[], [{ ...item, openingStock: -1 }], [{ ...item, sellingPrice: NaN }], [item, { ...item, sku: 'sh-1' }], Array(4001).fill(item)]) {
    assert.equal(bulkProductInput.safeParse({ items }).success, false);
  }
  assert.equal(bulkProductInput.safeParse({ items: [item] }).success, true);
});
const source = readFileSync(new URL('../server/index.ts', import.meta.url), 'utf8');
const route = stripTypeScriptTypes(source.slice(source.indexOf('app.post("/api/products/bulk",'), source.indexOf('app.put("/api/products/:id",')));
async function run(existing: string[] = [], failStock = false) {
  let handler: any; let response: any; let committed: any[] = []; const pending: any[] = [];
  const write = (table: string) => async ({ data }: any) => { if (failStock && table === 'stock') throw new Error('stock failed'); pending.push({ table, data }); };
  const tx = { productVariant: { findMany: async () => existing.map(sku => ({ sku })), createMany: write('variants') }, product: { createMany: write('products') }, taxRate: { upsert: async () => ({ id: 'tax' }) }, stockBalance: { createMany: write('stock') }, stockMovement: { createMany: write('movements') }, auditEvent: { create: write('audit') } };
  const db = { $transaction: async (fn: any) => { await fn(tx); committed = [...pending]; } };
  new Function('app', 'requirePermission', 'requireBranch', 'parseInput', 'bulkProductInput', 'db', 'Prisma', 'randomUUID', route)({ post: (_path: string, _permission: any, fn: any) => { handler = fn; } }, () => null, () => 'branch-1', parseInput, bulkProductInput, db, Prisma, randomUUID);
  let error: unknown;
  try { await handler({ body: { items: [item, { ...item, sku: 'SH-2', openingStock: 0 }] }, session: { organizationId: 'org-1', userId: 'user-1' } }, { status: (status: number) => ({ json: (body: any) => { response = { status, body }; } }) }); } catch (e) { error = e; }
  return { committed, response, error };
}
test('bulk save persists scoped products and opening stock together', async () => {
  const result = await run(); assert.equal(result.error, undefined); assert.equal(result.response.status, 201);
  const products = result.committed.find(x => x.table === 'products').data;
  assert.equal(products.length, 2); assert.equal(products[0].branchId, 'branch-1'); assert.equal(products[0].organizationId, 'org-1');
  const stock = result.committed.find(x => x.table === 'stock').data;
  assert.equal(stock.length, 1); assert.equal(stock[0].quantity, 10);
  const movements = result.committed.find(x => x.table === 'movements').data;
  assert.equal(movements[0].type, 'OPENING'); assert.equal(movements[0].variantId, stock[0].variantId);
});
test('duplicate database codes and stock failures do not commit a batch', async () => {
  for (const result of [await run(['sh-1']), await run([], true)]) { assert.ok(result.error); assert.deepEqual(result.committed, []); assert.equal(result.response, undefined); }
});
