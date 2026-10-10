import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { Prisma } from "@prisma/client";
import { invoiceInput, parseInput } from "../server/validation.ts";
import { nextAvailableSalesNumber } from "../server/sales-numbering.ts";

const source = readFileSync(new URL("../server/index.ts", import.meta.url), "utf8");
const start = source.indexOf('app.post("/api/sales",');
const end = source.indexOf('app.patch("/api/sales/:id/details",', start);
assert.ok(start >= 0 && end > start);
const code = stripTypeScriptTypes(source.slice(start, end));

async function save({ quantities = [1, 2], available = 10, failAudit = false, existing = false, maximum = 9, sequenceNext = 10 } = {}) {
  let handler: any;
  let response: any;
  let invoiceData: any;
  let movements: any[] = [];
  let payments: any[] = [];
  let allocations: any[] = [];
  let stock = available;
  let stockWrites = 0;
  let bulkWrites = 0;
  let aggregateReads = 0;
  let transactions = 0;
  let sequence = sequenceNext;
  const db: any = {
    organization: { findUniqueOrThrow: async () => ({ stateCode: "33" }) },
    productVariant: { findMany: async () => [{ id: "shirt", sku: "SHIRT", mrp: 100, purchasePrice: 50, product: { name: "Shirt", taxRate: { rate: 0 } } }] },
    stockBalance: { updateMany: async ({ where, data }: any) => {
      stockWrites++;
      assert.equal(where.quantity.gte, data.quantity.decrement);
      if (stock < where.quantity.gte) return { count: 0 };
      stock -= data.quantity.decrement;
      return { count: 1 };
    } },
    salesInvoice: {
      findUnique: async () => existing ? { id: "existing" } : null,
      create: async ({ data }: any) => { invoiceData = data; assert.ok(data.lines.createMany); return { id: "saved" }; },
      findUniqueOrThrow: async () => ({ id: "saved", ...invoiceData }),
    },
    documentSequence: {
      upsert: async () => ({ id: "sequence", nextNumber: ++sequence }),
      update: async ({ data }: any) => { sequence = data.nextNumber; },
    },
    stockMovement: { createMany: async ({ data }: any) => { bulkWrites++; movements = data; } },
    payment: { create: async ({ data }: any) => { payments.push(data); return { id: "receipt" }; } },
    paymentAllocation: { create: async ({ data }: any) => { allocations.push(data); } },
    auditEvent: { create: async () => { if (failAudit) throw new Error("Audit failed"); } },
    $queryRaw: async () => { aggregateReads++; return [{ maximum }]; },
  };
  db.$transaction = async (fn: any) => {
    transactions++;
    try { return await fn(db); }
    catch (error) { stock = available; invoiceData = undefined; movements = []; payments = []; allocations = []; sequence = sequenceNext; throw error; }
  };
  const dependencies = {
    app: { post: (_path: string, _auth: unknown, fn: any) => { handler = fn; } },
    requirePermission: () => null, requireBranch: () => "test-branch", db, Prisma,
    invoiceInput, parseInput, nextAvailableSalesNumber,
    getInvoiceSetting: async () => ({ invoicePrefix: "HB/SL" }),
    financialYear: () => "26-27", round2: (n: number) => Math.round(n * 100) / 100,
    paymentStatus: (paid: number, total: number) => paid <= 0 ? "UNPAID" : paid >= total ? "PAID" : "PARTIALLY_PAID",
  };
  new Function(...Object.keys(dependencies), code)(...Object.values(dependencies));
  let error: unknown;
  try {
    const res = { status: () => res, json: (data: any) => { response = data; } };
    await handler({ body: { idempotencyKey: "test-save-1", invoiceDate: "2026-10-10", placeOfSupply: "33", paidAmount: 150, lines: quantities.map(quantity => ({ variantId: "shirt", quantity, unitPrice: 100, discount: 0 })) }, session: { organizationId: "test-org", userId: "tester" } }, res);
  } catch (e) { error = e; }
  return { response, invoiceData, movements, payments, allocations, stock, stockWrites, bulkWrites, aggregateReads, transactions, sequence, error };
}

test("save batches lines/movements and deducts combined stock once per variant", async () => {
  const result = await save();
  assert.equal(result.error, undefined);
  assert.equal(result.stock, 7);
  assert.equal(result.stockWrites, 1);
  assert.equal(result.bulkWrites, 1);
  assert.equal(result.aggregateReads, 1);
  assert.equal(result.invoiceData.lines.createMany.data.length, 2);
  assert.equal(result.movements.length, 2);
  assert.equal(result.response.invoiceNumber, "HB/SL/26-27/10");
  assert.equal(result.response.grandTotal, 300);
  assert.equal(result.response.paymentStatus, "PARTIALLY_PAID");
  assert.equal(result.payments[0].amount, 150);
  assert.equal(result.allocations[0].salesInvoiceId, "saved");
});

test("large bills use one movement batch and one stock write for repeated variants", async () => {
  const result = await save({ quantities: Array(100).fill(1), available: 100 });
  assert.equal(result.error, undefined);
  assert.equal(result.stock, 0);
  assert.equal(result.stockWrites, 1);
  assert.equal(result.bulkWrites, 1);
  assert.equal(result.invoiceData.lines.createMany.data.length, 100);
});

test("combined demand exceeding stock rejects the entire bill", async () => {
  const result = await save({ quantities: [3, 3], available: 5 });
  assert.match(String(result.error), /Insufficient stock/);
  assert.equal(result.stock, 5);
  assert.equal(result.invoiceData, undefined);
  assert.equal(result.payments.length, 0);
});

test("fractional quantities do not falsely exceed available decimal stock", async () => {
  const result = await save({ quantities: [0.1, 0.2], available: 0.3 });
  assert.equal(result.error, undefined);
  assert.equal(result.stock, 0);
});

test("errors propagate through the transaction and prevent a success response", async () => {
  const result = await save({ failAudit: true });
  assert.match(String(result.error), /Audit failed/);
  assert.equal(result.response, undefined);
  assert.equal(result.stock, 10);
});

test("repeated idempotency key returns existing invoice without another transaction", async () => {
  const result = await save({ existing: true });
  assert.equal(result.response.id, "existing");
  assert.equal(result.transactions, 0);
  assert.equal(result.stockWrites, 0);
});

test("invoice numbering respects imported numbers and an already higher sequence", async () => {
  const imported = await save({ maximum: 500, sequenceNext: 10 });
  assert.equal(imported.response.invoiceNumber, "HB/SL/26-27/501");
  assert.equal(imported.sequence, 502);
  const ahead = await save({ maximum: 9, sequenceNext: 100 });
  assert.equal(ahead.response.invoiceNumber, "HB/SL/26-27/100");
});

test("number lookup keeps custom prefixes parameterized and retains rollout floor", async () => {
  const prefix = "custom_%'prefix/26-27/";
  const client: any = { $queryRaw: async (sql: Prisma.Sql) => {
    assert.ok(sql.values.includes(prefix));
    assert.ok(!sql.text.includes(prefix));
    return [{ maximum: 0 }];
  } };
  assert.equal(await nextAvailableSalesNumber(client, "org", "branch", prefix), 1);
  client.$queryRaw = async () => [{ maximum: 5 }];
  assert.equal(await nextAvailableSalesNumber(client, "org", "cmti1m17y0001w4zwwin3hmr8", "HB/SL/26-27/"), 1763);
});
