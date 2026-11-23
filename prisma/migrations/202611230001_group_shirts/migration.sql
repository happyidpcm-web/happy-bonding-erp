CREATE TABLE "GroupShirtOrder" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "organizationId" TEXT NOT NULL REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "branchId" TEXT NOT NULL REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "groupName" TEXT NOT NULL, "customerName" TEXT NOT NULL, "phone" TEXT NOT NULL,
 "deliveryDate" TEXT NOT NULL, "fabric" TEXT NOT NULL, "colour" TEXT NOT NULL,
 "sleeve" TEXT NOT NULL, "printing" TEXT NOT NULL, "notes" TEXT NOT NULL,
 "photo" TEXT NOT NULL, "advance" DOUBLE PRECISION NOT NULL DEFAULT 0,
 "lines" JSONB NOT NULL, "status" TEXT NOT NULL DEFAULT 'CONFIRMED',
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "GroupShirtOrder_organizationId_branchId_createdAt_idx" ON "GroupShirtOrder"("organizationId", "branchId", "createdAt");
