import assert from "node:assert/strict";
import { test } from "node:test";
import { staffAttendanceInput } from "../server/attendance-validation.ts";
import { attendanceLeaveDays } from "../src/pages/staff/attendance-summary.ts";

test("morning check-in saves without checkout; evening checkout completes it", () => {
  for (const status of ["PRESENT", "HALF_DAY"]) {
    for (const checkOut of [undefined, null, ""]) {
      assert.equal(staffAttendanceInput.safeParse({ status, checkIn: "10:10", checkOut }).success, true);
    }
    assert.equal(staffAttendanceInput.safeParse({ status, checkIn: "10:10", checkOut: "21:00" }).success, true);
    assert.equal(staffAttendanceInput.safeParse({ status, checkIn: "10:10", checkOut: "09:00" }).success, false);
    assert.equal(staffAttendanceInput.safeParse({ status, checkOut: "21:00" }).success, false);
    assert.equal(staffAttendanceInput.safeParse({ status, checkIn: "25:00" }).success, false);
  }
});

test("absent and leave need no working times", () => {
  for (const status of ["ABSENT", "LEAVE"]) assert.equal(staffAttendanceInput.safeParse({ status }).success, true);
});

test("four half-days equal one leave day without counting partial present as leave", () => {
  const half = { status: "HALF_DAY" };
  assert.equal(attendanceLeaveDays([half]), 0.25);
  assert.equal(attendanceLeaveDays([half, half, half, half]), 1);
  assert.equal(attendanceLeaveDays([half, half, half, half, { status: "LEAVE" }, { status: "PRESENT" }, { status: "ABSENT" }]), 2);
  assert.equal(attendanceLeaveDays([]), 0);
});
