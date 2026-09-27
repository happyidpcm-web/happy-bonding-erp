import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';
import { createRequire } from 'node:module';
import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const root = process.cwd();
const name = 'hb_numbering_test_' + Date.now();
const source = new URL(process.env.DATABASE_URL);
assert.ok(['localhost', '127.0.0.1'].includes(source.hostname));
const admin = new PrismaClient();
await admin.$executeRawUnsafe(`CREATE DATABASE "${name}"`);
source.pathname = '/' + name;
const env = { ...process.env, DATABASE_URL: source.toString(), API_PORT: '4012', PORT: '4012', AUTO_SETUP_DATABASE: 'false' };
execFileSync(process.execPath, [require.resolve('prisma/build/index.js'), 'db', 'push', '--skip-generate', '--schema', path.join(root, 'prisma/schema.prisma')], { env, stdio: 'pipe' });
const db = new PrismaClient({ datasources: { db: { url: source.toString() } } });
const cwd = path.join(root, 'scratch', name); mkdirSync(cwd, { recursive: true });
let child;
try {
  const org = await db.organization.create({ data: { name: 'Isolated numbering test' } });
  const role = await db.role.create({ data: { organizationId: org.id, name: 'Owner', permissions: ['*'] } });
  const branches = await Promise.all(['PCM', 'AMBAI'].map(code => db.branch.create({ data: { organizationId: org.id, code, name: code } })));
  await db.user.create({ data: { organizationId: org.id, roleId: role.id, name: 'Test', email: 'test@example.com', passwordHash: await hash('Test-password-123', 4), branches: { create: branches.map(b => ({ branchId: b.id })) } } });
  const tax = await db.taxRate.create({ data: { organizationId: org.id, name: 'Zero', rate: 0 } });
  const variants = [];
  for (const b of branches) {
    const p = await db.product.create({ data: { organizationId: org.id, branchId: b.id, name: 'Test item', category: 'Shirt', hsnCode: '6205', taxRateId: tax.id, variants: { create: { sku: 'TEST', purchasePrice: 100, sellingPrice: 150, mrp: 150 } } }, include: { variants: true } });
    variants.push(p.variants[0]);
    await db.stockBalance.create({ data: { branchId: b.id, variantId: p.variants[0].id, quantity: 10 } });
  }
  child = spawn(process.execPath, [require.resolve('tsx/cli'), path.join(root, 'server/index.ts')], { env, cwd, stdio: 'ignore', windowsHide: true });
  const base = 'http://127.0.0.1:4012/api';
  for (let i = 0; i < 80; i++) { try { if ((await fetch(base + '/health')).ok) break; } catch {} await new Promise(r => setTimeout(r, 250)); }
  const login = await fetch(base + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'test@example.com', password: 'Test-password-123' }) });
  assert.equal(login.status, 200); const { token } = await login.json();
  async function call(b, route, body, expected) {
    const r = await fetch(base + route, { method: body ? 'POST' : 'GET', headers: { Authorization: 'Bearer ' + token, 'x-branch-id': b.id, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    const result = await r.json();
    if (expected) assert.equal(r.status, expected, JSON.stringify(result)); else assert.ok(r.ok, JSON.stringify(result));
    return result;
  }
  const types = ['Quotation', 'Sales Return', 'Credit Note', 'Delivery Challan', 'Proforma Invoice', 'Purchase Invoice', 'Payment Out', 'Purchase Return', 'Debit Note', 'Purchase Order'];
  for (const type of types) {
    for (const [i, b] of branches.entries()) {
      const query = '/vouchers/next-number?type=' + encodeURIComponent(type) + '&prefix=TEST/';
      assert.equal((await call(b, query)).number, '1');
      const payload = { id: crypto.randomUUID(), type, number: 'TEST/1', date: '2026-09-27', party: 'Test supplier', amount: 300, items: [{ variantId: variants[i].id, name: 'Test item', hsn: '6205', qty: 3, price: 100, amount: 300 }] };
      const saved = await call(b, '/vouchers', payload, 201);
      assert.equal((await call(b, '/vouchers', payload, 201)).id, saved.id);
      assert.equal((await call(b, '/vouchers?type=' + encodeURIComponent(type))).length, 1);
      assert.equal((await call(b, query)).number, '2');
      assert.equal(await db.voucher.count({ where: { branchId: b.id, type, number: 'TEST/1' } }), 1);
    }
    console.log('PASS same number 1 in both branches: ' + type);
  }
  for (const [i, b] of branches.entries()) {
    assert.equal(Number((await db.stockBalance.findUniqueOrThrow({ where: { branchId_variantId: { branchId: b.id, variantId: variants[i].id } } })).quantity), 13);
    const invoice = await call(b, '/sales', { idempotencyKey: 'same-key-both-branches', invoiceDate: '2026-09-27', placeOfSupply: '33', lines: [{ variantId: variants[i].id, quantity: 1, unitPrice: 150, taxRate: 0 }] });
    assert.ok(invoice.invoiceNumber.endsWith('/1'));
    assert.equal(await db.salesInvoice.count({ where: { branchId: b.id, invoiceNumber: invoice.invoiceNumber } }), 1);
    assert.equal(Number((await db.stockBalance.findUniqueOrThrow({ where: { branchId_variantId: { branchId: b.id, variantId: variants[i].id } } })).quantity), 12);
  }
  console.log('PASS sales number 1 in both branches; persisted invoices, lists, stock and retry verified');
  for (const b of branches) {
    await db.expense.create({ data: { organizationId: org.id, branchId: b.id, category: 'Test expense', amount: 25, paymentMode: 'Cash', paidTo: b.code } });
    await db.payment.create({ data: { organizationId: org.id, branchId: b.id, direction: 'IN', mode: 'Cash', amount: 50, reference: b.code } });
    const feed = await call(b, '/transactions');
    assert.equal(feed.length, 13);
    for (const type of [...types, 'Sales Invoice', 'Expense', 'Payment In']) assert.ok(feed.some(r => r.type === type), type);
    assert.equal(feed.find(r => r.type === 'Expense').party, b.code);
    assert.equal(feed.find(r => r.type === 'Payment In').number, b.code);
    assert.ok(feed.every((r, i) => i === 0 || Date.parse(feed[i - 1].recordedAt) >= Date.parse(r.recordedAt)));
  }
  console.log('PASS transaction feed: all voucher types, sales, payments, expenses, latest-first and branch isolation');
  console.log('Test database: ' + name);
} finally { child?.kill(); await db.$disconnect(); await admin.$disconnect(); }
