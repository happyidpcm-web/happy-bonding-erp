import assert from "node:assert/strict";
import { test } from "node:test";
import { isInvoiceInDateRange } from "../src/utils/invoiceDateRange.ts";

const now = new Date(2026, 9, 8, 12);
test("display dates with time and Sept are parsed without falling back to today", () => {
  assert.equal(isInvoiceInDateRange({ date: "26 Sept 2026 5:30 am" }, "Today", undefined, now), false);
  assert.equal(isInvoiceInDateRange({ date: "26 Sept 2026 5:30 am" }, "Previous Month", undefined, now), true);
  assert.equal(isInvoiceInDateRange({ date: "invalid" }, "Today", undefined, now), false);
});
test("stored invoice date takes precedence over display date", () => {
  assert.equal(isInvoiceInDateRange({ date: "08 Oct 2026 5:30 am", dateISO: "2026-10-07" }, "Yesterday", undefined, now), true);
});
test("custom dates include both boundaries and a single full day", () => {
  const range = { from: "2026-09-26", to: "2026-10-05" };
  for (const [date, expected] of [["2026-09-25", false], ["2026-09-26", true], ["2026-10-05", true], ["2026-10-06", false]] as const) {
    assert.equal(isInvoiceInDateRange({ date }, "Custom Range", range, now), expected);
  }
  assert.equal(isInvoiceInDateRange({ date: "05 Oct 2026 5:30 am" }, "Custom Range", { from: "2026-10-05", to: "2026-10-05" }, now), true);
});
test("rolling range includes today and excludes older or future invoices", () => {
  for (const [date, expected] of [["2026-10-01", false], ["2026-10-02", true], ["2026-10-08", true], ["2026-10-09", false]] as const) {
    assert.equal(isInvoiceInDateRange({ date }, "Last 7 Days", undefined, now), expected);
  }
});
