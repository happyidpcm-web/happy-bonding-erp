CREATE TABLE "StaffAttendance" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "organizationId" TEXT NOT NULL REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "branchId" TEXT NOT NULL REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "staffId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "attendanceDate" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PRESENT',
  "checkIn" TEXT,
  "checkOut" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "StaffAttendance_organizationId_branchId_staffId_attendanceDate_key" ON "StaffAttendance"("organizationId", "branchId", "staffId", "attendanceDate");
CREATE INDEX "StaffAttendance_organizationId_branchId_attendanceDate_idx" ON "StaffAttendance"("organizationId", "branchId", "attendanceDate");
CREATE INDEX "StaffAttendance_staffId_attendanceDate_idx" ON "StaffAttendance"("staffId", "attendanceDate");
