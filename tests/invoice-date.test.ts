import assert from "node:assert/strict";
import { test } from "node:test";
import { api, saleFromApi } from "../src/api.ts";

const invoice = {
  id: "invoice-1", invoiceNumber: "HB/SL/26-27/1",
  invoiceDate: "2026-10-01T00:00:00.000Z",
  postedAt: "2026-10-08T12:00:00.000Z", createdAt: "2026-10-08T12:00:00.000Z",
  party: null, grandTotal: "450", paidAmount: "450", paymentStatus: "PAID",
  lines: [{ variantId: "inactive-item", itemName: "Old item", sku: "OLD", quantity: 1,
    unitPrice: "450", discount: "0", taxRate: "0", total: "450" }],
};

test("backdated invoices display invoice date instead of posting date", () => {
  const result = saleFromApi(invoice);
  assert.equal(result.dateISO, "2026-10-01");
  assert.match(result.date, /01 Oct 2026/);
  const updated = saleFromApi({ ...invoice, invoiceDate: "2026-09-25T00:00:00.000Z" });
  assert.equal(updated.dateISO, "2026-09-25");
  assert.match(updated.date, /25 Sept? 2026/);
});

test("date and notes correction sends no items or financial fields and uses saved response", async () => {
  const originals = { window: globalThis.window, localStorage: globalThis.localStorage, fetch: globalThis.fetch };
  Object.assign(globalThis, {
    window: { setTimeout, clearTimeout, dispatchEvent() {} },
    localStorage: { getItem() { return null; } },
    fetch: async (url: string, options: RequestInit) => {
      assert.equal(url, "/api/sales/invoice-1/details");
      assert.equal(options.method, "PATCH");
      assert.deepEqual(JSON.parse(String(options.body)), { invoiceDate: "2026-09-25", notes: "Corrected date" });
      return new Response(JSON.stringify({ ...invoice, invoiceDate: "2026-09-25T00:00:00.000Z", notes: "Corrected date" }), { headers: { "content-type": "application/json" } });
    },
  });
  try {
    const updated = await api.updateSaleDetails(invoice.id, { invoiceDate: "2026-09-25", notes: "Corrected date" });
    assert.equal(updated.dateISO, "2026-09-25");
    assert.match(updated.date, /25 Sept? 2026/);
    assert.equal(updated.amount, 450);
    assert.equal(updated.lines?.[0].variantId, "inactive-item");
  } finally { Object.assign(globalThis, originals); }
});
