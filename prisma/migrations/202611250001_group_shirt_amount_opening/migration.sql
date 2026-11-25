CREATE TABLE "GroupShirtAmountOpening" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "organizationId" TEXT NOT NULL REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "branchId" TEXT NOT NULL REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "openingAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "GroupShirtAmountOpening_organizationId_branchId_key" ON "GroupShirtAmountOpening"("organizationId", "branchId");
CREATE INDEX "GroupShirtAmountOpening_organizationId_branchId_idx" ON "GroupShirtAmountOpening"("organizationId", "branchId");
