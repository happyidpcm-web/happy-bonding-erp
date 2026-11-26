export function attendanceLeaveDays(rows: { status: string }[]) {
  return rows.reduce((days, row) => days + (row.status === "LEAVE" ? 1 : row.status === "HALF_DAY" ? 0.25 : 0), 0);
}
