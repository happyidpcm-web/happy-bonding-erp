import assert from "node:assert/strict";
import { test } from "node:test";
import { attendanceRangeDates } from "../src/pages/staff/attendance-range.ts";

test("custom range includes both boundaries across months and years", () => {
  assert.deepEqual(attendanceRangeDates("2026-12-31", "2027-01-02"), ["2026-12-31", "2027-01-01", "2027-01-02"]);
  assert.deepEqual(attendanceRangeDates("2026-11-26", "2026-11-26"), ["2026-11-26"]);
  assert.equal(attendanceRangeDates("2024-02-28", "2024-03-01").length, 3);
});
test("empty and reversed ranges produce no attendance dates", () => {
  assert.deepEqual(attendanceRangeDates("", "2026-11-26"), []);
  assert.deepEqual(attendanceRangeDates("2026-11-27", "2026-11-26"), []);
});
