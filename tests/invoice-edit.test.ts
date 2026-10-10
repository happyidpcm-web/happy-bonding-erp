import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { Prisma, PaymentStatus } from "@prisma/client";
import { planInvoiceEdit } from "../server/invoice-edit.ts";
import { invoiceInput, parseInput } from "../server/validation.ts";

const line = { variantId: "shirt", quantity: 2, unitPrice: 100, mrp: 120, discount: 0, taxRate: 0 };
const input = (overrides = {}) => invoiceInput.parse({
  idempotencyKey: "test-edit-1", invoiceDate: "2026-10-10", placeOfSupply: "33",
  paidAmount: 200, lines: [{ ...line }], ...overrides,
});
const saved = () => ({
  id: "invoice-1", invoiceNumber: "TEST/1", status: "POSTED", placeOfSupply: "33",
  invoiceDiscount: 0, additionalCharges: 0, grandTotal: 200, paidAmount: 0,
  lines: [{ ...line, id: "original-line", total: 200, purchasePriceAtSale: 50 }], payments: [],
});

test("payment and metadata edits preserve lines, totals and stock; row order is irrelevant", () => {
  const original: any = saved();
  original.lines.push({ ...original.lines[0], variantId: "pant" });
  for (const paidAmount of [0, 50, 200]) {
    const plan = planInvoiceEdit(original, input({ paidAmount, notes: "Updated", lines: [...original.lines].reverse() }));
    assert.equal(plan.linesChanged, false);
    assert.equal(plan.totalsChanged, false);
    assert.equal(plan.stockChanged, false);
  }
});

test("price, discount, MRP and tax changes update lines without rewriting stock", () => {
  for (const change of [{ unitPrice: 110 }, { discount: 10 }, { mrp: 130 }, { taxRate: 5 }]) {
    const plan = planInvoiceEdit(saved() as any, input({ lines: [{ ...line, ...change }] }));
    assert.equal(plan.linesChanged, true);
    assert.equal(plan.totalsChanged, true);
    assert.equal(plan.stockChanged, false);
  }
});

test("invoice discounts and tax jurisdiction recalculate lines; charges only affect totals", () => {
  for (const change of [{ invoiceDiscount: 20 }, { placeOfSupply: "32" }]) {
    const plan = planInvoiceEdit(saved() as any, input(change));
    assert.equal(plan.linesChanged, true);
    assert.equal(plan.stockChanged, false);
  }
  const plan = planInvoiceEdit(saved() as any, input({ additionalCharges: 25 }));
  assert.equal(plan.linesChanged, false);
  assert.equal(plan.totalsChanged, true);
  assert.equal(plan.stockChanged, false);
});

test("quantity changes and item replacements require stock updates", () => {
  for (const change of [{ quantity: 3 }, { variantId: "pant" }]) {
    const plan = planInvoiceEdit(saved() as any, input({ lines: [{ ...line, ...change }] }));
    assert.equal(plan.linesChanged, true);
    assert.equal(plan.stockChanged, true);
  }
});

test("duplicate lines are matched once and stock uses their combined quantity", () => {
  const original: any = saved();
  original.lines.push({ ...original.lines[0], unitPrice: 150 });
  const plan = planInvoiceEdit(original, input({ lines: [{ ...line }, { ...line }] }));
  assert.equal(plan.linesChanged, true);
  assert.equal(plan.stockChanged, false);
  const split = planInvoiceEdit(saved() as any, input({ lines: [{ ...line, quantity: 1 }, { ...line, quantity: 1 }] }));
  assert.equal(split.linesChanged, true);
  assert.equal(split.stockChanged, false);
  assert.equal(split.newQuantities.get("shirt"), 2);
});

// Exercise the actual PUT handler without starting the server or connecting
// to a real database. Keep authentication/transaction storage as test doubles.
const source = readFileSync(new URL("../server/index.ts", import.meta.url), "utf8");
const start = source.indexOf('app.put("/api/sales/:id",');
const end = source.indexOf('app.delete("/api/sales/:id",', start);
assert.ok(start >= 0 && end > start);
const handlerCode = stripTypeScriptTypes(source.slice(start, end));

async function runEdit(body: ReturnType<typeof input>, previous: any = saved(), available = 10) {
  let handler: any;
  let data: any;
  let response: any;
  let stockCalls = 0;
  let lineDeletes = 0;
  const payments: any[] = [];
  const audits: any[] = [];
  const db: any = {
    salesInvoice: {
      findFirst: async () => previous,
      findFirstOrThrow: async () => previous,
      update: async (args: any) => { data = args.data; return previous; },
      findUniqueOrThrow: async () => ({ ...previous, ...Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined)) }),
    },
    organization: { findUniqueOrThrow: async () => ({ stateCode: "33" }) },
    productVariant: { findMany: async () => [...new Set(body.lines.map(l => l.variantId))].map(id => ({
      id, sku: id, mrp: 999, purchasePrice: 999, product: { name: "Changed catalog name", taxRate: { rate: 18 } },
    })) },
    stockBalance: {
      upsert: async () => { stockCalls++; },
      findUnique: async () => { stockCalls++; return { quantity: available }; },
      update: async () => { stockCalls++; },
    },
    stockMovement: { deleteMany: async () => { stockCalls++; }, createMany: async () => { stockCalls++; } },
    salesInvoiceLine: { deleteMany: async () => { lineDeletes++; } },
    payment: {
      create: async ({ data }: any) => { payments.push(data); return { id: "receipt-1" }; },
      findFirstOrThrow: async () => ({ id: "old-receipt", amount: 200 }),
      update: async (args: any) => { payments.push(args.data); },
    },
    paymentAllocation: { create: async () => {}, update: async () => {} },
    auditEvent: { create: async ({ data }: any) => { audits.push(data); } },
  };
  db.$transaction = async (callback: any) => callback(db);
  const dependencies = {
    app: { put: (_path: string, _auth: unknown, fn: unknown) => { handler = fn; } },
    requirePermission: () => null, requireBranch: () => "branch-1",
    db, invoiceInput, parseInput, planInvoiceEdit, Prisma,
    round2: (n: number) => Math.round(n * 100) / 100,
    paymentStatus: (paid: number, total: number) => paid >= total ? PaymentStatus.PAID : paid > 0 ? PaymentStatus.PARTIALLY_PAID : PaymentStatus.UNPAID,
  };
  new Function(...Object.keys(dependencies), handlerCode)(...Object.values(dependencies));
  await handler({ body, params: { id: previous.id }, query: { response: "invoice" }, session: { organizationId: "org-1", userId: "user-1" } }, {
    json: (value: any) => { response = value; },
  });
  return { data, response, stockCalls, lineDeletes, payments, audits };
}

test("PUT unpaid/partial to fully paid preserves historical lines, costs and stock", async () => {
  for (const paidAmount of [0, 50]) {
    const previous = { ...saved(), paidAmount };
    const result = await runEdit(input(), previous);
    assert.equal(result.stockCalls, 0);
    assert.equal(result.lineDeletes, 0);
    assert.equal(result.data.lines, undefined);
    assert.equal(result.data.grandTotal, undefined);
    assert.equal(result.response.lines[0].purchasePriceAtSale, 50);
    assert.equal(result.data.paidAmount, 200);
    assert.equal(result.data.paymentStatus, PaymentStatus.PAID);
    assert.equal(result.payments[0].amount, 200 - paidAmount);
    assert.equal(result.audits.length, 1);
  }
});

test("PUT partial payment and paid-to-unpaid correction avoid stock and retain audit", async () => {
  const partial = await runEdit(input({ paidAmount: 50 }));
  assert.equal(partial.data.paymentStatus, PaymentStatus.PARTIALLY_PAID);
  assert.equal(partial.stockCalls, 0);
  const previous = { ...saved(), paidAmount: 200, payments: [{ id: "allocation-1", paymentId: "old-receipt", amount: 200, payment: { paidAt: new Date() } }] };
  const corrected = await runEdit(input({ paidAmount: 0 }), previous);
  assert.equal(corrected.stockCalls, 0);
  assert.equal(corrected.lineDeletes, 0);
  assert.equal(corrected.data.paymentStatus, PaymentStatus.UNPAID);
  assert.equal(corrected.payments[0].amount.decrement, 200);
  assert.equal(corrected.audits[0].metadata.paymentCorrections[0].after, 0);
});

test("PUT fully paid settles the saved total despite browser rounding differences", async () => {
  const previous = { ...saved(), grandTotal: 200.01, paidAmount: 150 };
  const result = await runEdit(input({ paidAmount: 200, markFullyPaid: true }), previous);
  assert.equal(result.data.paidAmount, 200.01);
  assert.equal(result.data.paymentStatus, PaymentStatus.PAID);
  assert.equal(result.payments[0].amount, 50.01);
  assert.equal(result.stockCalls, 0);
  assert.equal(result.lineDeletes, 0);
  assert.equal(result.data.grandTotal, undefined);

  const partial = await runEdit(input({ paidAmount: 200 }), previous);
  assert.equal(partial.data.paidAmount, 200);
  assert.equal(partial.data.paymentStatus, PaymentStatus.PARTIALLY_PAID);
});

test("PUT fully paid uses the updated total when charges change", async () => {
  const result = await runEdit(input({ paidAmount: 200, additionalCharges: 25, markFullyPaid: true }));
  assert.equal(result.data.grandTotal, 225);
  assert.equal(result.data.paidAmount, 225);
  assert.equal(result.data.paymentStatus, PaymentStatus.PAID);
  assert.equal(result.payments[0].amount, 225);
});

test("PUT price plus payment changes recalculate totals without stock writes", async () => {
  const result = await runEdit(input({ lines: [{ ...line, unitPrice: 150 }], paidAmount: 300 }));
  assert.equal(result.stockCalls, 0);
  assert.equal(result.lineDeletes, 1);
  assert.equal(result.data.grandTotal, 300);
  assert.equal(result.data.paidAmount, 300);
});

test("PUT quantity plus payment changes update stock, lines and totals", async () => {
  const result = await runEdit(input({ lines: [{ ...line, quantity: 3 }], paidAmount: 300 }));
  assert.ok(result.stockCalls > 0);
  assert.equal(result.lineDeletes, 1);
  assert.equal(result.data.grandTotal, 300);
  assert.equal(result.data.paidAmount, 300);
});

test("PUT extra charges preserve historical tax and line values", async () => {
  const result = await runEdit(input({ additionalCharges: 25, lines: [{ ...line, taxRate: undefined }] }));
  assert.equal(result.stockCalls, 0);
  assert.equal(result.lineDeletes, 0);
  assert.equal(result.data.grandTotal, 225);
  assert.equal(result.data.taxableTotal, undefined);
});

test("PUT checks combined demand of duplicate item rows", async () => {
  await assert.rejects(runEdit(input({ lines: [{ ...line, quantity: 3 }, { ...line, quantity: 3 }] }), saved(), 5), /Insufficient stock/);
});
