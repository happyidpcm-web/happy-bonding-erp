import assert from "node:assert/strict";
import { test } from "node:test";
import { api } from "../src/api.ts";

test("create and edit return the saved invoice without downloading sales history", async () => {
  const originals = { window: globalThis.window, localStorage: globalThis.localStorage, fetch: globalThis.fetch };
  const calls: Array<{ url: string; method?: string }> = [];
  const requestTimeouts: number[] = [];
  const row = {
    id: "saved-1", invoiceNumber: "TEST/1", invoiceDate: "2026-10-09T00:00:00.000Z",
    party: { name: "Customer", phone: "9876543210" }, grandTotal: "100", paidAmount: "100",
    paymentStatus: "PAID", payments: [{ payment: { mode: "UPI" } }],
    lines: [{ variantId: "item-1", itemName: "Shirt", sku: "SHIRT", quantity: 1, unitPrice: "100", discount: "0", taxRate: "0", total: "100" }],
  };
  Object.assign(globalThis, {
    window: { setTimeout(handler: () => void, delay: number) { requestTimeouts.push(delay); return setTimeout(handler, delay); }, clearTimeout, dispatchEvent() {} },
    localStorage: { getItem() { return null; } },
    fetch: async (url: string, options: RequestInit) => {
      calls.push({ url, method: options.method });
      assert.equal(JSON.parse(options.body as string).markFullyPaid, true);
      assert.ok(options.method === "POST" || options.method === "PUT", "Saving must not reload the sales list");
      return new Response(JSON.stringify(row), { headers: { "content-type": "application/json" } });
    },
  });
  try {
    const input = { paidAmount: 100, markFullyPaid: true, paymentMode: "UPI" as const, lines: [{ variantId: "item-1", quantity: 1, unitPrice: 100, discount: 0 }] };
    for (const saved of [await api.createSale(input), await api.updateSale("saved-1", input)]) {
      assert.equal(saved.id, "saved-1");
      assert.equal(saved.party, "Customer");
      assert.equal(saved.paymentMode, "UPI");
      assert.equal(saved.lines?.[0].variantId, "item-1");
      assert.equal(saved.amount, 100);
    }
    assert.deepEqual(calls, [
      { url: "/api/sales", method: "POST" },
      { url: "/api/sales/saved-1?response=invoice", method: "PUT" },
    ]);
    assert.deepEqual(requestTimeouts, [30000, 60000], "Invoice edits must wait beyond the server's 30-second transaction deadline");
  } finally { Object.assign(globalThis, originals); }
});
