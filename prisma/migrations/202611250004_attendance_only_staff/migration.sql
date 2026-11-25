CREATE TABLE "AttendanceStaff" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "organizationId" TEXT NOT NULL REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "branchId" TEXT NOT NULL REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "name" TEXT NOT NULL,
  "phone" TEXT,
  "role" TEXT NOT NULL DEFAULT 'Staff',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "AttendanceStaff_organizationId_branchId_active_idx" ON "AttendanceStaff"("organizationId", "branchId", "active");
CREATE TABLE "AttendanceEntry" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "organizationId" TEXT NOT NULL REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "branchId" TEXT NOT NULL REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "staffId" TEXT NOT NULL REFERENCES "AttendanceStaff"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "attendanceDate" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PRESENT',
  "checkIn" TEXT,
  "checkOut" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "AttendanceEntry_organizationId_branchId_staffId_attendanceDate_key" ON "AttendanceEntry"("organizationId", "branchId", "staffId", "attendanceDate");
CREATE INDEX "AttendanceEntry_organizationId_branchId_attendanceDate_idx" ON "AttendanceEntry"("organizationId", "branchId", "attendanceDate");
CREATE INDEX "AttendanceEntry_staffId_attendanceDate_idx" ON "AttendanceEntry"("staffId", "attendanceDate");
