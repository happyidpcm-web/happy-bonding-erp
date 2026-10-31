import assert from "node:assert/strict";
import { test } from "node:test";
import { isInvoiceInDateRange, invoiceTime, isValidCustomDateRange } from "../src/utils/invoiceDateRange.ts";
import { saleFromApi } from "../src/api.ts";

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

test("custom time range matches displayed invoice time, including both minute boundaries", () => {
  const range = { from: "2026-10-31", to: "2026-10-31", fromTime: "10:00", toTime: "14:00" };
  for (const [time, expected] of [["9:59 am", false], ["10:00 am", true], ["12:00 pm", true], ["2:00 pm", true], ["2:01 pm", false]] as const) {
    assert.equal(isInvoiceInDateRange({ date: `31 Oct 2026 ${time}`, dateISO: "2026-10-31" }, "Custom Range", range), expected, time);
  }
  assert.equal(isInvoiceInDateRange({ date: "31 Oct 2026", dateISO: "2026-10-31" }, "Custom Range", range), false);
});

test("backdated API invoices filter by invoice calendar date and recorded IST time", () => {
  const invoice = saleFromApi({ id: "time", invoiceNumber: "TEST", invoiceDate: "2026-10-30T00:00:00.000Z", createdAt: "2026-10-31T11:46:45.000Z", party: null, grandTotal: "600", paymentStatus: "PAID" });
  assert.equal(invoiceTime(invoice), "17:16");
  assert.equal(isInvoiceInDateRange(invoice, "Custom Range", { from: "2026-10-30", to: "2026-10-30", fromTime: "17:16", toTime: "17:16" }), true);
  assert.equal(isInvoiceInDateRange(invoice, "Custom Range", { from: "2026-10-31", to: "2026-10-31", fromTime: "17:16", toTime: "17:16" }), false);
});

test("overnight ranges, optional endpoints and midnight/noon are handled correctly", () => {
  const range = { from: "2026-10-30", to: "2026-10-31", fromTime: "22:00", toTime: "02:00" };
  assert.equal(isValidCustomDateRange(range), true);
  assert.equal(isValidCustomDateRange({ ...range, from: "2026-10-31" }), false);
  assert.equal(isInvoiceInDateRange({ date: "31 Oct 2026 12:00 am" }, "Custom Range", range), true);
  assert.equal(isInvoiceInDateRange({ date: "31 Oct 2026 12:00 pm" }, "Custom Range", range), false);
  assert.equal(isInvoiceInDateRange({ date: "31 Oct 2026 11:59 pm" }, "Custom Range", { from: "2026-10-31", to: "2026-10-31", fromTime: "22:00" }), true);
  assert.equal(isInvoiceInDateRange({ date: "31 Oct 2026 12:00 am" }, "Custom Range", { from: "2026-10-31", to: "2026-10-31", toTime: "02:00" }), true);
  assert.equal(invoiceTime({ date: "31 Oct 2026 12:00 pm" }), "12:00");
  assert.equal(invoiceTime({ date: "31 Oct 2026 12:00 am" }), "00:00");
});
