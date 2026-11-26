import { z } from "zod";

const attendanceTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use a valid time");
export const staffAttendanceInput = z.object({
  status: z.enum(["PRESENT", "ABSENT", "LEAVE", "HALF_DAY"]),
  checkIn: z.preprocess(value => value === "" ? null : value, attendanceTime.optional().nullable()),
  checkOut: z.preprocess(value => value === "" ? null : value, attendanceTime.optional().nullable()),
  notes: z.string().trim().max(500).optional().default(""),
}).strict().superRefine((value, context) => {
  if ((value.status === "PRESENT" || value.status === "HALF_DAY") && !value.checkIn) context.addIssue({ code: "custom", message: "Enter check-in time for present or half-day attendance." });
  if (value.checkIn && value.checkOut && value.checkOut < value.checkIn) context.addIssue({ code: "custom", message: "Check-out time must be after check-in time." });
});

