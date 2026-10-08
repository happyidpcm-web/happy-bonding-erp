import assert from "node:assert/strict";
import { test } from "node:test";
import { saleFromApi } from "../src/api.ts";
const base = { id: "time-test", invoiceNumber: "HB/SL/26-27/15", invoiceDate: "2026-10-05T00:00:00.000Z", party: null, grandTotal: "100", paymentStatus: "PAID" };
test("invoice calendar date keeps actual creation time in India instead of midnight UTC", () => {
  const result = saleFromApi({ ...base, createdAt: "2026-10-08T12:42:00.000Z", postedAt: "2026-10-08T12:43:00.000Z" });
  assert.equal(result.dateISO, "2026-10-05");
  assert.match(result.date, /05 Oct 2026/);
  assert.match(result.date, /6:12 pm/i);
  assert.doesNotMatch(result.date, /5:30 am/i);
});
test("posting time is fallback; missing timestamps do not invent a billing time", () => {
  assert.match(saleFromApi({ ...base, postedAt: "2026-10-08T23:15:00.000Z" }).date, /4:45 am/i);
  assert.equal(saleFromApi(base).date, "05 Oct 2026");
});
